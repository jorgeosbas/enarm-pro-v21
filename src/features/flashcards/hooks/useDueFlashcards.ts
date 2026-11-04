import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { shuffleArray } from '@/lib/utils/shuffle';
import {
  STUDY_TIMEZONE,
  getLocalDateString,
  startOfLocalDayUtcISO,
} from '@/lib/utils/localDay';
import { FlashcardWithProgress } from '../types';

/**
 * Tope diario de tarjetas NUEVAS que entran a la lista del día.
 * Los repasos (que FSRS ya programó) nunca se limitan.
 * Solo cuentan tarjetas de temas ACTIVADOS por el usuario.
 */
const DAILY_NEW_CARD_LIMIT = 40;

/** Tamaño de cada bloque para la práctica intercalada por bloques. */
const SHUFFLE_BLOCK_SIZE = 10;

/** Máximo de ids por consulta `.in(...)`. */
const IN_CHUNK_SIZE = 100;
/** Máximo de filas por insert. */
const INSERT_CHUNK_SIZE = 500;
/** Tamaño de página de Supabase. */
const PAGE_SIZE = 1000;
/** Las listas de días viejos se borran pasado este tiempo. */
const OLD_LISTS_RETENTION_DAYS = 30;

export interface DailyFlashcardSession {
  sessionDate: string;
  total: number;
  completedIds: string[];
  queue: FlashcardWithProgress[];
  /** Cuántos temas tiene activados el usuario. 0 = debe elegir temas primero. */
  activeThemeCount: number;
}

type SupabaseBrowserClient = ReturnType<typeof createClient>;

interface DailyRow {
  question_id: string;
  position: number;
  completed: boolean;
}

/** Baraja `items` en bloques de `blockSize`, preservando el orden entre bloques. */
function shuffleInBlocks<T>(items: T[], blockSize: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < items.length; i += blockSize) {
    const block = items.slice(i, i + blockSize);
    result.push(...shuffleArray(block));
  }
  return result;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Lee TODAS las filas de una consulta paginando de 1000 en 1000. */
async function fetchAllPages(
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

/** Campos que se piden del progreso FSRS — se declara una vez. */
const PROGRESS_SELECT = `
  id,
  due_date,
  stability,
  difficulty,
  elapsed_days,
  scheduled_days,
  reps,
  lapses,
  state,
  last_review,
  created_at,
  updated_at,
  user_id,
  question_id,
  question:questions!inner(
    id,
    sequence_number,
    theme_id,
    subcategory_id,
    difficulty,
    vignette,
    explanation,
    subcategory:subcategories(
      id,
      name,
      specialty:specialties(id, name)
    ),
    theme:themes(id, name)
  )
`;

/** Ids de los temas que el usuario ya activó. */
async function fetchActiveThemeIds(
  supabase: SupabaseBrowserClient,
  userId: string
): Promise<Set<string>> {
  const untyped = supabase as unknown as SupabaseClient;
  const rows = await fetchAllPages((from, to) =>
    untyped
      .from('user_active_themes')
      .select('theme_id')
      .eq('user_id', userId)
      .order('theme_id', { ascending: true })
      .range(from, to)
  );
  return new Set(rows.map((r) => String(r.theme_id)));
}

/** Lista del día guardada (ordenada por posición). */
async function fetchDailyRows(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionDate: string
): Promise<DailyRow[]> {
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('flashcard_daily_cards')
      .select('question_id, position, completed')
      .eq('user_id', userId)
      .eq('session_date', sessionDate)
      .order('position', { ascending: true })
      .range(from, to)
  );
  return rows as DailyRow[];
}

/** Ids de repasos vencidos ahora (state != new), de más atrasado a menos, solo de temas activos. */
async function fetchDueReviewIds(
  supabase: SupabaseBrowserClient,
  userId: string,
  nowUtc: string,
  activeThemes: Set<string>
): Promise<string[]> {
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('user_flashcard_progress')
      .select('question_id, question:questions!inner(id, theme_id)')
      .eq('user_id', userId)
      .lte('due_date', nowUtc)
      .neq('state', 'new')
      .order('due_date', { ascending: true })
      .order('question_id', { ascending: true })
      .range(from, to)
  );
  return rows
    .filter((r) => activeThemes.has(String(r.question?.theme_id)))
    .map((r) => String(r.question_id));
}

/** Ids de tarjetas NUEVAS vencidas de temas activos, hasta `limit`. */
async function fetchDueNewIds(
  supabase: SupabaseBrowserClient,
  userId: string,
  nowUtc: string,
  activeThemes: Set<string>,
  limit: number
): Promise<string[]> {
  if (limit <= 0 || activeThemes.size === 0) return [];
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('user_flashcard_progress')
      .select('question_id, question:questions!inner(id, theme_id)')
      .eq('user_id', userId)
      .lte('due_date', nowUtc)
      .eq('state', 'new')
      .order('due_date', { ascending: true })
      .order('question_id', { ascending: true })
      .range(from, to)
  );
  return rows
    .filter((r) => activeThemes.has(String(r.question?.theme_id)))
    .slice(0, limit)
    .map((r) => String(r.question_id));
}

/** De los ids dados, cuáles ya vuelven a pedir repaso (due_date <= ahora). */
async function fetchDueAgainIds(
  supabase: SupabaseBrowserClient,
  userId: string,
  nowUtc: string,
  ids: string[]
): Promise<Set<string>> {
  const result = new Set<string>();
  for (const part of chunk(ids, IN_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('user_flashcard_progress')
      .select('question_id')
      .eq('user_id', userId)
      .lte('due_date', nowUtc)
      .in('question_id', part);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as any[]) {
      result.add(String(r.question_id));
    }
  }
  return result;
}

/** Cuántas tarjetas nuevas ya debutaron hoy (hora local). */
async function countDebutsToday(
  supabase: SupabaseBrowserClient,
  userId: string,
  dayStartUtc: string
): Promise<number> {
  const { count, error } = await supabase
    .from('user_flashcard_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('state', 'new')
    .lte('reps', 1)
    .gte('last_review', dayStartUtc);
  if (error) throw error;
  return count ?? 0;
}

async function insertDailyRows(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionDate: string,
  questionIds: string[],
  startPosition: number
): Promise<void> {
  const rows = questionIds.map((questionId, i) => ({
    user_id: userId,
    session_date: sessionDate,
    question_id: questionId,
    position: startPosition + i,
    completed: false,
  }));

  // Cliente sin tipos de tabla: flashcard_daily_cards no está en los tipos generados.
  const untyped = supabase as unknown as SupabaseClient;

  for (const part of chunk(rows, INSERT_CHUNK_SIZE)) {
    const { error } = await untyped
      .from('flashcard_daily_cards')
      .upsert(part, {
        onConflict: 'user_id,session_date,question_id',
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
}

/**
 * Arma la lista del día (se llama solo la primera vez que se entra en el día).
 *   A) REPASOS: vencidas con state != 'new'. Sin límite.
 *   B) NUEVAS: vencidas con state = 'new', topadas al cupo. Solo temas activos.
 */
async function createTodaySnapshot(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionDate: string,
  nowUtc: string,
  dayStartUtc: string,
  activeThemes: Set<string>
): Promise<void> {
  const debutsToday = await countDebutsToday(supabase, userId, dayStartUtc);
  const remainingNew = Math.max(0, DAILY_NEW_CARD_LIMIT - debutsToday);

  const reviewIds = await fetchDueReviewIds(supabase, userId, nowUtc, activeThemes);
  const newIds = await fetchDueNewIds(supabase, userId, nowUtc, activeThemes, remainingNew);

  const ordered = shuffleInBlocks([...reviewIds, ...newIds], SHUFFLE_BLOCK_SIZE);
  if (ordered.length > 0) {
    await insertDailyRows(supabase, userId, sessionDate, ordered, 0);
  }

  // Limpieza de listas viejas (no es crítica).
  const cutoffDate = getLocalDateString(
    new Date(Date.now() - OLD_LISTS_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  );
  const { error: cleanupError } = await supabase
    .from('flashcard_daily_cards')
    .delete()
    .eq('user_id', userId)
    .lt('session_date', cutoffDate);
  if (cleanupError) {
    console.warn('[useDueFlashcards] No se pudo limpiar listas viejas:', cleanupError);
  }
}

/**
 * Si durante el día vence un repaso que no estaba en la lista, se agrega al final.
 * Las nuevas NO se agregan aquí: su tope se aplica una sola vez.
 */
async function topUpDueReviews(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionDate: string,
  nowUtc: string,
  existingRows: DailyRow[],
  activeThemes: Set<string>
): Promise<boolean> {
  const dueIds = await fetchDueReviewIds(supabase, userId, nowUtc, activeThemes);
  const inList = new Set(existingRows.map((r) => r.question_id));
  const missing = dueIds.filter((id) => !inList.has(id));
  if (missing.length === 0) return false;

  const lastPosition = existingRows.reduce((max, r) => Math.max(max, r.position), -1);
  await insertDailyRows(supabase, userId, sessionDate, missing, lastPosition + 1);
  return true;
}

/**
 * Cuántas flashcards quedan HOY. Lo usa el Dashboard.
 * Respeta temas activos y el tope diario.
 */
export async function countPendingFlashcardsToday(
  supabase: SupabaseBrowserClient,
  userId: string
): Promise<number> {
  const now = new Date();
  const nowUtc = now.toISOString();
  const sessionDate = getLocalDateString(now, STUDY_TIMEZONE);
  const dayStartUtc = startOfLocalDayUtcISO(now, STUDY_TIMEZONE);

  const activeThemes = await fetchActiveThemeIds(supabase, userId);
  if (activeThemes.size === 0) return 0;

  const reviewIds = await fetchDueReviewIds(supabase, userId, nowUtc, activeThemes);
  const rows = await fetchDailyRows(supabase, userId, sessionDate);

  if (rows.length > 0) {
    // La lista de hoy ya existe: lo que falta + repasos que venzan y no estén en ella.
    const inList = new Set(rows.map((r) => r.question_id));
    const pending = rows.filter((r) => !r.completed).length;
    const missingReviews = reviewIds.filter((id) => !inList.has(id)).length;

    const completedIds = rows.filter((r) => r.completed).map((r) => r.question_id);
    const dueAgain = await fetchDueAgainIds(supabase, userId, nowUtc, completedIds);

    return pending + dueAgain.size + missingReviews;
  }

  // La lista de hoy aún no existe: estimar lo que se va a armar.
  const debutsToday = await countDebutsToday(supabase, userId, dayStartUtc);
  const remainingNew = Math.max(0, DAILY_NEW_CARD_LIMIT - debutsToday);
  const newIds = await fetchDueNewIds(supabase, userId, nowUtc, activeThemes, remainingNew);

  return reviewIds.length + newIds.length;
}

/**
 * Construye la sesión de flashcards del día.
 *  - Primera entrada del día: arma y guarda la lista.
 *  - Entradas siguientes: reutiliza la lista guardada.
 *
 * Si el usuario no tiene temas activos, no se arma nada.
 * Esta función NO escribe en user_flashcard_progress: FSRS no se toca.
 */
export async function loadDailyFlashcardSession(
  supabase: SupabaseBrowserClient
): Promise<DailyFlashcardSession> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  const now = new Date();
  const sessionDate = getLocalDateString(now, STUDY_TIMEZONE);

  if (!user) {
    return { sessionDate, total: 0, completedIds: [], queue: [], activeThemeCount: 0 };
  }

  const userId = user.id;
  const nowUtc = now.toISOString();
  const dayStartUtc = startOfLocalDayUtcISO(now, STUDY_TIMEZONE);

  const activeThemes = await fetchActiveThemeIds(supabase, userId);
  const activeThemeCount = activeThemes.size;

  if (activeThemeCount === 0) {
    return { sessionDate, total: 0, completedIds: [], queue: [], activeThemeCount: 0 };
  }

  // ── Lista del día: se arma una vez, luego se reutiliza ─────────────────
  let rows = await fetchDailyRows(supabase, userId, sessionDate);

  if (rows.length === 0) {
    await createTodaySnapshot(supabase, userId, sessionDate, nowUtc, dayStartUtc, activeThemes);
    rows = await fetchDailyRows(supabase, userId, sessionDate);
  } else {
    const added = await topUpDueReviews(
      supabase,
      userId,
      sessionDate,
      nowUtc,
      rows,
      activeThemes
    );
    if (added) rows = await fetchDailyRows(supabase, userId, sessionDate);
  }

  if (rows.length === 0) {
    return { sessionDate, total: 0, completedIds: [], queue: [], activeThemeCount };
  }

  const completedIds = rows.filter((r) => r.completed).map((r) => r.question_id);
  const dueAgain = await fetchDueAgainIds(supabase, userId, nowUtc, completedIds);

  // Orden: el de la lista del día (rows ya viene por posición).
  const queueIds = rows
    .filter((r) => !r.completed || dueAgain.has(r.question_id))
    .map((r) => r.question_id);

  if (queueIds.length === 0) {
    return { sessionDate, total: rows.length, completedIds, queue: [], activeThemeCount };
  }

  // ── Datos completos de las tarjetas de la cola ─────────────────────────
  const progressByQuestion = new Map<string, any>();
  for (const ids of chunk(queueIds, IN_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('user_flashcard_progress')
      .select(PROGRESS_SELECT)
      .eq('user_id', userId)
      .in('question_id', ids);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as any[]) {
      progressByQuestion.set(String(r.question_id), r);
    }
  }

  const allOptions: any[] = [];
  for (const ids of chunk(queueIds, IN_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('question_options')
      .select('id, question_id, label, content, is_correct')
      .in('question_id', ids);
    if (error) throw error;
    allOptions.push(...((data ?? []) as unknown as any[]));
  }

  // ── Mapear al shape que consume la UI ──────────────────────────────────
  const queue: FlashcardWithProgress[] = [];
  for (const questionId of queueIds) {
    const flashcard = progressByQuestion.get(questionId);
    if (!flashcard) continue;

    queue.push({
      id: flashcard.question_id,
      sequence_number: flashcard.question?.sequence_number ?? null,
      theme_id: flashcard.question?.theme_id ?? null,
      subcategory_id: flashcard.question?.subcategory_id,
      difficulty: flashcard.question?.difficulty,
      vignette: flashcard.question?.vignette,
      explanation: flashcard.question?.explanation ?? null,
      options: allOptions
        .filter((opt) => opt?.question_id === flashcard.question_id)
        .sort((a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? ''))),
      subcategory: flashcard.question?.subcategory,
      theme: flashcard.question?.theme,
      progress: {
        id: flashcard.id,
        user_id: flashcard.user_id,
        question_id: flashcard.question_id,
        stability: flashcard.stability,
        difficulty: flashcard.difficulty,
        elapsed_days: flashcard.elapsed_days,
        scheduled_days: flashcard.scheduled_days,
        reps: flashcard.reps,
        lapses: flashcard.lapses,
        state: flashcard.state,
        last_review: flashcard.last_review,
        due_date: flashcard.due_date,
        created_at: flashcard.created_at,
        updated_at: flashcard.updated_at,
      },
    } as FlashcardWithProgress);
  }

  return { sessionDate, total: rows.length, completedIds, queue, activeThemeCount };
}

export function useDueFlashcards() {
  return useQuery({
    queryKey: ['dueFlashcards'],
    queryFn: async (): Promise<DailyFlashcardSession> => {
      const supabase = createClient();
      return loadDailyFlashcardSession(supabase);
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
