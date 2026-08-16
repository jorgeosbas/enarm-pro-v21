import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { shuffleArray } from '@/lib/utils/shuffle';
import { FlashcardWithProgress } from '../types';

/**
 * Tope diario de tarjetas NUEVAS que entran a la sesión.
 *
 * Evita el "efecto avalancha": al importar un lote grande de preguntas,
 * todas se inicializan con due_date en el pasado y entrarían de golpe a la
 * cola. Con este tope entran de a poco, y los repasos (que FSRS ya programó
 * y son obligatorios) nunca se limitan.
 *
 * ES POR DÍA REAL, NO POR SESIÓN: el tope se calcula contando cuántas
 * tarjetas nuevas ya viste HOY (en cualquier entrada anterior a la app),
 * no solo las de esta carga de pantalla. Si entras 3 veces en el día, el
 * cupo se va gastando entre esas 3 entradas — no se reinicia cada vez que
 * abres Flashcards.
 */
const DAILY_NEW_CARD_LIMIT = 40;

/**
 * Tamaño de cada bloque para la "práctica intercalada por bloques".
 *
 * En vez de barajar TODA la cola (lo que perdería el orden "más vencidas
 * primero" de los repasos), se ordena por vencimiento y se baraja SOLO
 * dentro de bloques de este tamaño. Esto rompe el agrupamiento por tema
 * (20 tarjetas del mismo tema importadas juntas ya no salen todas
 * seguidas) sin perder la prioridad: si un día no terminas la cola,
 * las tarjetas más atrasadas siguen estando cerca del principio.
 */
const SHUFFLE_BLOCK_SIZE = 10;

/**
 * Baraja `items` en bloques de `blockSize`, preservando el orden relativo
 * ENTRE bloques (solo se mezcla el interior de cada bloque).
 */
function shuffleInBlocks<T>(items: T[], blockSize: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < items.length; i += blockSize) {
    const block = items.slice(i, i + blockSize);
    result.push(...shuffleArray(block));
  }
  return result;
}

/** Campos que se piden en ambas queries — se declara una vez para no duplicar. */
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

/**
 * Hook que arma la cola de flashcards de la sesión.
 *
 * Estrategia en tres queries:
 *   0) CONTEO DEL DÍA — cuántas tarjetas nuevas ya "debutaron" hoy (su
 *      primera calificación fue hoy), para saber cuánto cupo queda del
 *      tope diario. Se identifica una tarjeta como "debutada hoy" cuando
 *      su última calificación fue hoy Y reps <= 1 — es decir, es su
 *      primera calificación exitosa o su primer intento fallido. Esto es
 *      correcto en el caso normal; el único caso borde (poco común) es
 *      una tarjeta MUY antigua que llevas fallando ("Repetir") una y otra
 *      vez durante meses sin nunca acertarla — su reps se queda en 0 cada
 *      vez, así que si la fallas hoy, se contaría como "debut de hoy" sin
 *      serlo. El efecto de ese caso borde es mínimo: en el peor caso te
 *      "cuesta" un cupo de nueva que no era, nunca te muestra de más.
 *   A) REPASOS — vencidas con state != 'new'. SIN límite: FSRS ya decidió
 *      que tocan hoy y saltárselas rompería la programación.
 *   B) NUEVAS — vencidas con state = 'new', limitadas al cupo que quede
 *      del tope diario (DAILY_NEW_CARD_LIMIT menos las que ya debutaron
 *      hoy en entradas anteriores).
 *
 * Todas llevan .eq('user_id', userId) explícito. Es redundante con RLS a
 * propósito: si una política de RLS se aflojara por error, el filtro del
 * código sigue impidiendo que se mezcle el progreso de otro usuario.
 *
 * Los dos conjuntos (repasos + nuevas) se unen y se barajan (práctica
 * intercalada): así el orden deja de ser predecible y no se memoriza por
 * posición en la cola.
 */
export function useDueFlashcards() {
  return useQuery({
    queryKey: ['dueFlashcards'],
    queryFn: async (): Promise<FlashcardWithProgress[]> => {
      const supabase = createClient();

      // ── Usuario autenticado (necesario para el filtro explícito) ─────────
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) return [];

      const userId = user.id;

      // Ajuste de Zona Horaria: Enviar UTC exacto al milisegundo
      const nowUtc = new Date().toISOString();

      // Inicio del día de HOY en UTC (medianoche UTC, no la hora local del
      // usuario) — es el mismo criterio de "día" que ya usa due_date en el
      // resto del proyecto, para no mezclar dos nociones distintas de "día".
      const now = new Date();
      const todayStartUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      ).toISOString();

      // ── Query 0: cuántas tarjetas nuevas ya debutaron hoy ────────────────
      const { count: newCardsToday, error: countError } = await supabase
        .from('user_flashcard_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('state', 'new')
        .lte('reps', 1)
        .gte('last_review', todayStartUtc);

      if (countError) throw countError;

      const remainingNewToday = Math.max(0, DAILY_NEW_CARD_LIMIT - (newCardsToday ?? 0));

      // ── Query A: REPASOS (sin límite) ────────────────────────────────────
      const reviewsPromise = supabase
        .from('user_flashcard_progress')
        .select(PROGRESS_SELECT)
        .eq('user_id', userId)
        .lte('due_date', nowUtc)
        .neq('state', 'new')
        .order('due_date', { ascending: true });

      // ── Query B: NUEVAS (topeadas al cupo que quede del día) ─────────────
      // Si ya no queda cupo, ni se hace la consulta — devuelve vacío directo.
      const newCardsPromise =
        remainingNewToday > 0
          ? supabase
              .from('user_flashcard_progress')
              .select(PROGRESS_SELECT)
              .eq('user_id', userId)
              .lte('due_date', nowUtc)
              .eq('state', 'new')
              .order('due_date', { ascending: true })
              .limit(remainingNewToday)
          : Promise.resolve({ data: [], error: null } as const);

      // Se lanzan en paralelo: no dependen una de otra.
      const [reviewsResult, newCardsResult] = await Promise.all([
        reviewsPromise,
        newCardsPromise,
      ]);

      if (reviewsResult.error) throw reviewsResult.error;
      if (newCardsResult.error) throw newCardsResult.error;

      const reviews = (reviewsResult.data ?? []) as unknown as any[];
      const newCards = (newCardsResult.data ?? []) as unknown as any[];

      // ── Unir y barajar POR BLOQUES (práctica intercalada) ────────────────
      // El barajeo total (versión anterior) rompía el agrupamiento por tema,
      // pero también perdía "más vencidas primero" en los repasos. Barajar
      // por bloques de SHUFFLE_BLOCK_SIZE consigue ambas cosas: dentro de
      // cada bloque el orden es aleatorio (temas mezclados), pero un bloque
      // de tarjetas muy atrasadas sigue apareciendo antes que uno reciente.
      const combined = shuffleInBlocks([...reviews, ...newCards], SHUFFLE_BLOCK_SIZE);

      if (combined.length === 0) return [];

      // ── Opciones de respuesta, solo de las preguntas de esta cola ────────
      const questionIds = combined
        .map((f: any) => f?.question_id)
        .filter((id: any): id is string => typeof id === 'string');

      if (questionIds.length === 0) return [];

      const { data: options, error: optionsError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (optionsError) throw optionsError;

      const allOptions = (options ?? []) as unknown as any[];

      // ── Mapear al shape que consume la UI ────────────────────────────────
      return combined.map((flashcard: any) => ({
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
      })) as FlashcardWithProgress[];
    },
    staleTime: 0, // 👈 CRÍTICO: Anula caché para que SIEMPRE traiga datos reales tras calificar
    refetchOnWindowFocus: true, // Recargar al regresar a la pestaña
  });
}