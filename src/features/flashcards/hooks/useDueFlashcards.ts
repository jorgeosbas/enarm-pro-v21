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
 *
 * Evita el "efecto avalancha": al importar un lote grande de preguntas,
 * todas se inicializan con due_date en el pasado y entrarían de golpe.
 * Los repasos (que FSRS ya programó y son obligatorios) nunca se limitan.
 *
 * El tope se aplica UNA sola vez al armar la lista del día (ver
 * createTodaySnapshot), contando las nuevas que ya debutaron hoy (hora
 * local) por si la lista se arma a mitad del día.
 */
const DAILY_NEW_CARD_LIMIT = 40;

/**
 * Tamaño de cada bloque para la "práctica intercalada por bloques": se
 * ordena por vencimiento y se baraja SOLO dentro de bloques de este
 * tamaño, para romper el agrupamiento por tema sin perder la prioridad
 * de las más atrasadas.
 */
const SHUFFLE_BLOCK_SIZE = 10;

/** Máximo de ids por consulta `.in(...)` (evita URLs demasiado largas). */
const IN_CHUNK_SIZE = 100;
/** Máximo de filas por insert. */
const INSERT_CHUNK_SIZE = 500;
/** Tamaño de página de Supabase (por defecto devuelve máx. 1000 filas). */
const PAGE_SIZE = 1000;
/** Las listas de días viejos se borran pasado este tiempo. */
const OLD_LISTS_RETENTION_DAYS = 30;

/**
 * Lo que la pantalla necesita para mostrar la sesión del día.
 *  - total:        cuántas tarjetas componen el día (el "Y" de "X de Y").
 *  - completedIds: tarjetas ya terminadas hoy con Fácil / Bien / Difícil.
 *  - queue:        lo que falta por ver ahora, incluidas las marcadas
 *                  "Repetir" (aunque FSRS las haya programado en unos minutos).
 */
export interface DailyFlashcardSession {
  sessionDate: string;
  total: number;
  completedIds: string[];
  queue: FlashcardWithProgress[];
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

/** Ids de repasos vencidos ahora (state != new), de más atrasado a menos. */
async function fetchDueReviewIds(
  supabase: SupabaseBrowserClient,
  userId: string,
  nowUtc: string
): Promise<string[]> {
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('user_flashcard_progress')
      .select('question_id, question:questions!inner(id)')
      .eq('user_id', userId)
      .lte('due_date', nowUtc)
      .neq('state', 'new')
      .order('due_date', { ascending: true })
      .order('question_id', { ascending: true })
      .range(from, to)
  );
  return rows.map((r) => String(r.question_id));
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

  // Cliente sin tipos de tabla: los tipos generados todavía no conocen
  // flashcard_daily_cards (npm run gen-types los regenera cuando quieras).
  const untyped = supabase as unknown as SupabaseClient;

  for (const part of chunk(rows, INSERT_CHUNK_SIZE)) {
    // ignoreDuplicates: si dos pestañas/dispositivos arman la lista a la
    // vez, la segunda no pisa a la primera.
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
 *
 *   0) Cupo de nuevas: DAILY_NEW_CARD_LIMIT menos las que ya debutaron hoy.
 *   A) REPASOS — vencidas con state != 'new'. SIN límite.
 *   B) NUEVAS  — vencidas con state = 'new', topadas al cupo.
 *
 * Se unen y se barajan por bloques (práctica intercalada).
 */
async function createTodaySnapshot(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionDate: string,
  nowUtc: string,
  dayStartUtc: string
): Promise<void> {
  const { count: debutsToday, error: countError } = await supabase
    .from('user_flashcard_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('state', 'new')
    .lte('reps', 1)
    .gte('last_review', dayStartUtc);

  if (countError) throw countError;

  const remainingNew = Math.max(0, DAILY_NEW_CARD_LIMIT - (debutsToday ?? 0));

  const reviewIds = await fetchDueReviewIds(supabase, userId, nowUtc);

  let newIds: string[] = [];
  if (remainingNew > 0) {
    const { data, error } = await supabase
      .from('user_flashcard_progress')
      .select('question_id, question:questions!inner(id)')
      .eq('user_id', userId)
      .lte('due_date', nowUtc)
      .eq('state', 'new')
      .order('due_date', { ascending: true })
      .limit(remainingNew);
    if (error) throw error;
    newIds = ((data ?? []) as unknown as any[]).map((r) => String(r.question_id));
  }

  const ordered = shuffleInBlocks([...reviewIds, ...newIds], SHUFFLE_BLOCK_SIZE);
  if (ordered.length > 0) {
    await insertDailyRows(supabase, userId, sessionDate, ordered, 0);
  }

  // Limpieza de listas viejas (no es crítica: si falla, no se interrumpe).
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
 * Si durante el día vence un repaso que no estaba en la lista (por ejemplo,
 * uno que repasaste ayer en la noche y hoy ya le toca), se agrega al final.
 * Las tarjetas NUEVAS no se agregan aquí: su tope se aplica una sola vez.
 * Devuelve true si agregó algo.
 */
async function topUpDueReviews(
  supabase: SupabaseBrowserClient,
  userId: string,
  sessionDate: string,
  nowUtc: string,
  existingRows: DailyRow[]
): Promise<boolean> {
  const dueIds = await fetchDueReviewIds(supabase, userId, nowUtc);
  const inList = new Set(existingRows.map((r) => r.question_id));
  const missing = dueIds.filter((id) => !inList.has(id));
  if (missing.length === 0) return false;

  const lastPosition = existingRows.reduce((max, r) => Math.max(max, r.position), -1);
  await insertDailyRows(supabase, userId, sessionDate, missing, lastPosition + 1);
  return true;
}

/**
 * Construye la sesión de flashcards del día.
 *
 *  - Primera entrada del día (hora local): arma y guarda la lista.
 *  - Entradas siguientes: reutiliza la lista guardada, así "X de Y" se
 *    mantiene aunque salgas y vuelvas.
 *
 * Lo que falta por ver (queue) = tarjetas de la lista que no están
 * terminadas (incluidas las de "Repetir", aunque FSRS las programe en unos
 * minutos) + las terminadas que FSRS ya vuelve a pedir (por ejemplo una
 * "Difícil" de unos minutos).
 *
 * Todas las consultas llevan .eq('user_id', userId) explícito. Es
 * redundante con RLS a propósito (defensa en profundidad).
 *
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

  if (!user) return { sessionDate, total: 0, completedIds: [], queue: [] };

  const userId = user.id;
  const nowUtc = now.toISOString();
  const dayStartUtc = startOfLocalDayUtcISO(now, STUDY_TIMEZONE);

  // ── Lista del día: se arma una vez, luego se reutiliza ─────────────────
  let rows = await fetchDailyRows(supabase, userId, sessionDate);

  if (rows.length === 0) {
    await createTodaySnapshot(supabase, userId, sessionDate, nowUtc, dayStartUtc);
    rows = await fetchDailyRows(supabase, userId, sessionDate);
  } else {
    const added = await topUpDueReviews(supabase, userId, sessionDate, nowUtc, rows);
    if (added) rows = await fetchDailyRows(supabase, userId, sessionDate);
  }

  if (rows.length === 0) {
    return { sessionDate, total: 0, completedIds: [], queue: [] };
  }

  const completedIds = rows.filter((r) => r.completed).map((r) => r.question_id);

  // ── Terminadas que FSRS ya vuelve a pedir (due_date <= ahora) ──────────
  const dueAgain = new Set<string>();
  for (const ids of chunk(completedIds, IN_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('user_flashcard_progress')
      .select('question_id')
      .eq('user_id', userId)
      .lte('due_date', nowUtc)
      .in('question_id', ids);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as any[]) {
      dueAgain.add(String(r.question_id));
    }
  }

  // Orden: el de la lista del día (rows ya viene por posición).
  const queueIds = rows
    .filter((r) => !r.completed || dueAgain.has(r.question_id))
    .map((r) => r.question_id);

  if (queueIds.length === 0) {
    return { sessionDate, total: rows.length, completedIds, queue: [] };
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
    if (!flashcard) continue; // pregunta borrada u oculta: se omite

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

  return { sessionDate, total: rows.length, completedIds, queue };
}

export function useDueFlashcards() {
  return useQuery({
    queryKey: ['dueFlashcards'],
    queryFn: async (): Promise<DailyFlashcardSession> => {
      const supabase = createClient();
      return loadDailyFlashcardSession(supabase);
    },
    staleTime: 0, // CRÍTICO: anula caché para que SIEMPRE traiga datos reales
    // La pantalla de flashcards pide los datos a mano (refetch) al entrar y
    // lleva su propio estado; refrescar al volver a la pestaña solo
    // repetiría consultas pesadas sin que nadie use el resultado.
    refetchOnWindowFocus: false,
  });
}
