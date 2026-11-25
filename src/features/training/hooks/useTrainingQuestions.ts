/**
 * useTrainingQuestions
 *
 * Hook para el modo Entrenamiento Inteligente.
 * Obtiene preguntas, datos FSRS (solo lectura), estadísticas de tema e historial,
 * aplica el Priority Score y devuelve las N preguntas más prioritarias.
 *
 * NO modifica ningún dato de Flashcards ni de FSRS.
 */

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  fetchAllPages,
  fetchOptionsByQuestionIds,
  groupOptionsByQuestion,
} from '@/lib/supabase/fetchAll';
import {
  selectTrainingQuestions,
  type FSRSReadonlyData,
  type ThemeStats,
  type LastAttempt,
  type QuestionForScoring,
} from '../domain/priorityScore';
import type { RandomQuestion } from '@/features/question-bank/hooks/useRandomQuestions';

export interface TrainingQuestion extends RandomQuestion {
  importance: number;
}

type SupabaseBrowserClient = ReturnType<typeof createClient>;

/**
 * Arma las N preguntas del Entrenamiento Inteligente.
 *
 * Todas las lecturas van paginadas (Supabase corta en 1000 filas sin avisar)
 * y las opciones de respuesta se piden SOLO para las preguntas ya elegidas,
 * no para todo el banco. Antes se pedían las de todo el banco en una sola
 * consulta: al pasar de 1000 opciones, a las preguntas más nuevas les
 * llegaban cero opciones y se veían sin respuestas.
 */
export async function loadTrainingQuestions(
  supabase: SupabaseBrowserClient,
  count: number
): Promise<TrainingQuestion[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('No autenticado');

  const userId = user.id;

  // ── 1. Traer todas las preguntas del banco (con importance) ──────────
  // Banco Compartido: se trae TODO el banco, no solo las preguntas que
  // importó este usuario. Antes filtraba por user_id = dueño de la
  // pregunta, así que un usuario nuevo (sin preguntas propias) nunca
  // recibía preguntas en el modo Entrenamiento Inteligente.
  const questionsRaw = await fetchAllPages<any>((from, to) =>
    supabase
      .from('questions')
      .select(`
        id,
        sequence_number,
        theme_id,
        subcategory_id,
        difficulty,
        importance,
        vignette,
        explanation,
        subcategory:subcategories(id, name, specialty:specialties(id, name)),
        theme:themes(id, name)
      `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
  );

  if (questionsRaw.length === 0) return [];

  // ── 2. Leer datos FSRS de solo lectura ───────────────────────────────
  // IMPORTANTE: Solo SELECT, nunca INSERT/UPDATE.
  // Este módulo trata user_flashcard_progress como fuente read-only.
  // Se leen todas las filas del usuario (paginadas) y se cruzan en memoria
  // con el banco: evita mandar cientos de ids en la dirección de la consulta.
  const fsrsRows = await fetchAllPages<any>((from, to) =>
    supabase
      .from('user_flashcard_progress')
      .select('question_id, stability, reps, last_review, due_date')
      .eq('user_id', userId)
      .order('question_id', { ascending: true })
      .range(from, to)
  );

  const fsrsMap = new Map<string, FSRSReadonlyData>(
    fsrsRows.map((row: any) => [
      row.question_id,
      {
        question_id: row.question_id,
        stability:   row.stability,
        reps:        row.reps,
        last_review: row.last_review,
        due_date:    row.due_date,
      },
    ])
  );

  // ── 3. Historial de respuestas del usuario (una sola lectura) ────────
  // Antes eran dos consultas y ambas se cortaban en 1000 filas: con más de
  // 1000 respuestas, las preguntas contestadas hace tiempo parecían
  // "nunca vistas" y las estadísticas por tema salían incompletas.
  // Viene ordenado de la más reciente a la más antigua.
  const answerLogs = await fetchAllPages<any>((from, to) =>
    supabase
      .from('answer_logs')
      .select('id, question_id, is_correct, answered_at')
      .eq('user_id', userId)
      .order('answered_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
  );

  // Agrupar por theme_id usando el mapa de preguntas
  const themeIdByQuestion = new Map<string, string | null>(
    questionsRaw.map((q: any) => [q.id, q.theme_id])
  );

  // Estadísticas por tema
  const themeStatsMap = new Map<string, ThemeStats>();
  // Último intento por pregunta
  const lastAttemptMap = new Map<string, LastAttempt>();
  // Última vez que se tocó CADA TEMA (en cualquier modo de quiz) —
  // alimenta el cooldown de 24h que evita que un mismo tema domine
  // sesión tras sesión.
  const themeLastPracticedMap = new Map<string, string>();

  for (const log of answerLogs) {
    const themeId = themeIdByQuestion.get(log.question_id);

    // Estadísticas por tema
    if (themeId) {
      if (!themeStatsMap.has(themeId)) {
        themeStatsMap.set(themeId, {
          theme_id: themeId,
          total_attempts: 0,
          correct_attempts: 0,
        });
      }
      const stats = themeStatsMap.get(themeId)!;
      stats.total_attempts++;
      if (log.is_correct) stats.correct_attempts++;
    }

    // Quedarse solo con el intento más reciente por pregunta
    if (!lastAttemptMap.has(log.question_id)) {
      lastAttemptMap.set(log.question_id, {
        question_id: log.question_id,
        answered_at: log.answered_at,
      });
    }

    // El historial viene ordenado de más reciente a más antiguo, así que
    // el primero que veamos de cada tema es el más reciente.
    if (themeId && !themeLastPracticedMap.has(themeId)) {
      themeLastPracticedMap.set(themeId, log.answered_at);
    }
  }

  // ── 4. Construir lista de preguntas con todos los datos para scoring ─
  // Las opciones NO se necesitan para puntuar; se cargan después, solo
  // para las preguntas elegidas.
  const questionsForScoring = questionsRaw.map((q: any) => {
    const qForScore: QuestionForScoring = {
      id:         q.id,
      theme_id:   q.theme_id,
      importance: q.importance ?? 3,
    };
    return {
      question: {
        ...q,
        importance: q.importance ?? 3,
        options: [],
      } as TrainingQuestion,
      fsrsData:   fsrsMap.get(q.id) ?? null,
      themeStats: q.theme_id ? (themeStatsMap.get(q.theme_id) ?? null) : null,
      lastAttempt: lastAttemptMap.get(q.id) ?? null,
      themeLastPracticed: q.theme_id
        ? (themeLastPracticedMap.get(q.theme_id) ?? null)
        : null,
      // Para selectTrainingQuestions necesita el QuestionForScoring
      _scoring: qForScore,
    };
  });

  // ── 5. Aplicar el algoritmo de selección ─────────────────────────────
  const selected = selectTrainingQuestions(
    questionsForScoring.map((item) => ({
      question: { ...item.question, ...item._scoring } as any,
      fsrsData:    item.fsrsData,
      themeStats:  item.themeStats,
      lastAttempt: item.lastAttempt,
      themeLastPracticed: item.themeLastPracticed,
    })),
    count
  );

  // Reconstruir con datos completos (el algoritmo solo devuelve las
  // preguntas seleccionadas), en el orden que el algoritmo decidió.
  const questionById = new Map<string, TrainingQuestion>(
    questionsForScoring.map((item) => [item.question.id, item.question])
  );
  const ordered = selected
    .map((s: any) => questionById.get(s.id))
    .filter((q): q is TrainingQuestion => q !== undefined);

  // ── 6. Opciones de respuesta: solo de las preguntas elegidas ─────────
  const optionsByQuestion = groupOptionsByQuestion(
    await fetchOptionsByQuestionIds(
      supabase,
      ordered.map((q) => q.id)
    )
  );

  return ordered.map((q) => ({
    ...q,
    options: optionsByQuestion.get(q.id) ?? [],
  }));
}

export function useTrainingQuestions(count: number) {
  return useQuery({
    queryKey: ['trainingQuestions', count],
    queryFn: async (): Promise<TrainingQuestion[]> => {
      const supabase = createClient();
      return loadTrainingQuestions(supabase, count);
    },
    staleTime: 0,
    // La lista de preguntas se queda fija mientras contestas (ver nota en
    // useRandomQuestions): ni al volver a la app ni al reconectarse.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}