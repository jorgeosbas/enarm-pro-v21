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

export function useTrainingQuestions(count: number) {
  return useQuery({
    queryKey: ['trainingQuestions', count],
    queryFn: async (): Promise<TrainingQuestion[]> => {
      const supabase = createClient();

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
      const { data: questionsRaw, error: qError } = await supabase
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
        .order('created_at', { ascending: false });

      if (qError) throw qError;
      if (!questionsRaw || questionsRaw.length === 0) return [];

      // ── 2. Traer opciones de respuesta ───────────────────────────────────
      const questionIds = (questionsRaw as any[]).map((q: any) => q.id);

      const { data: options, error: oError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (oError) throw oError;

      // ── 3. Leer datos FSRS de solo lectura ───────────────────────────────
      // IMPORTANTE: Solo SELECT, nunca INSERT/UPDATE.
      // Este módulo trata user_flashcard_progress como fuente read-only.
      const { data: fsrsRows } = await supabase
        .from('user_flashcard_progress')
        .select('question_id, stability, reps, last_review, due_date')
        .eq('user_id', userId)
        .in('question_id', questionIds);

      const fsrsMap = new Map<string, FSRSReadonlyData>(
        (fsrsRows || []).map((row: any) => [
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

      // ── 4. Estadísticas del usuario por tema (de answer_logs) ────────────
      const { data: answerLogs } = await supabase
        .from('answer_logs')
        .select('question_id, is_correct')
        .eq('user_id', userId);

      // Agrupar por theme_id usando el mapa de preguntas
      const themeIdByQuestion = new Map<string, string | null>(
        (questionsRaw as any[]).map((q: any) => [q.id, q.theme_id])
      );

      const themeStatsMap = new Map<string, ThemeStats>();
      for (const log of answerLogs || []) {
        const themeId = themeIdByQuestion.get((log as any).question_id);
        if (!themeId) continue;

        if (!themeStatsMap.has(themeId)) {
          themeStatsMap.set(themeId, {
            theme_id: themeId,
            total_attempts: 0,
            correct_attempts: 0,
          });
        }
        const stats = themeStatsMap.get(themeId)!;
        stats.total_attempts++;
        if ((log as any).is_correct) stats.correct_attempts++;
      }

      // ── 5. Último intento por pregunta ───────────────────────────────────
      const { data: lastAttemptRows } = await supabase
        .from('answer_logs')
        .select('question_id, answered_at')
        .eq('user_id', userId)
        .in('question_id', questionIds)
        .order('answered_at', { ascending: false });

      // Quedarse solo con el intento más reciente por pregunta
      const lastAttemptMap = new Map<string, LastAttempt>();
      for (const row of lastAttemptRows || []) {
        const r = row as any;
        if (!lastAttemptMap.has(r.question_id)) {
          lastAttemptMap.set(r.question_id, {
            question_id: r.question_id,
            answered_at: r.answered_at,
          });
        }
      }

      // ── 6. Construir lista de preguntas con todos los datos para scoring ─
      const questionsForScoring = (questionsRaw as any[]).map((q: any) => {
        const qForScore: QuestionForScoring = {
          id:         q.id,
          theme_id:   q.theme_id,
          importance: q.importance ?? 3,
        };
        return {
          question: {
            ...q,
            importance: q.importance ?? 3,
            options: (options || [])
              .filter((opt: any) => opt.question_id === q.id)
              .sort((a: any, b: any) => a.label.localeCompare(b.label)),
          } as TrainingQuestion,
          fsrsData:   fsrsMap.get(q.id) ?? null,
          themeStats: q.theme_id ? (themeStatsMap.get(q.theme_id) ?? null) : null,
          lastAttempt: lastAttemptMap.get(q.id) ?? null,
          // Para selectTrainingQuestions necesita el QuestionForScoring
          _scoring: qForScore,
        };
      });

      // ── 7. Aplicar el algoritmo de selección ─────────────────────────────
      const selected = selectTrainingQuestions(
        questionsForScoring.map((item) => ({
          question: { ...item.question, ...item._scoring } as any,
          fsrsData:    item.fsrsData,
          themeStats:  item.themeStats,
          lastAttempt: item.lastAttempt,
        })),
        count
      );

      // Reconstruir con datos completos (el algoritmo solo devuelve las preguntas seleccionadas)
      const selectedIds = new Set(selected.map((q: any) => q.id));
      return questionsForScoring
        .filter((item) => selectedIds.has(item.question.id))
        .map((item) => item.question)
        .sort(
          (a, b) =>
            selected.findIndex((s: any) => s.id === a.id) -
            selected.findIndex((s: any) => s.id === b.id)
        );
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
