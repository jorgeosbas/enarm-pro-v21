import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { FlashcardWithProgress } from '../types';

/**
 * Hook para traer todas las flashcards que están debidas hoy (o antes)
 * Se ordena por due_date (las más urgentes primero)
 */
export function useDueFlashcards() {
  return useQuery({
    queryKey: ['dueFlashcards'],
    queryFn: async () => {
      console.log('[useDueFlashcards] Trayendo flashcards debidas...');
      const supabase = createClient();

      // Ajuste de Zona Horaria: Enviar UTC exacto al milisegundo
      const nowUtc = new Date().toISOString();

      const { data: dueFlashcards, error } = await supabase
        .from('user_flashcard_progress')
        .select(
          `
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
        `
        )
        // Eliminamos el estado 'new' del filtro y confiamos SOLO en la fecha de vencimiento
        .lte('due_date', nowUtc)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('[useDueFlashcards] Error:', error);
        throw error;
      }

      const dueCount = dueFlashcards?.length || 0;
      console.log(`[useDueFlashcards] Encontradas ${dueCount} flashcards debidas`);

      if (!dueFlashcards || dueCount === 0) {
        return [];
      }

      // Traer opciones de respuesta
      const questionIds = (dueFlashcards as any[]).map((f: any) => f.question_id);

      const { data: options, error: optionsError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (optionsError) {
        console.error('[useDueFlashcards] Error fetching options:', optionsError);
        throw optionsError;
      }

      // Mapear todo junto
      return (dueFlashcards as any[]).map((flashcard: any) => ({
        id: flashcard.question_id,
        sequence_number: flashcard.question?.sequence_number,
        theme_id: flashcard.question?.theme_id,
        subcategory_id: flashcard.question?.subcategory_id,
        difficulty: flashcard.question?.difficulty,
        vignette: flashcard.question?.vignette,
        explanation: flashcard.question?.explanation,
        options: (options || [])
          .filter((opt: any) => opt.question_id === flashcard.question_id)
          .sort((a: any, b: any) => a.label.localeCompare(b.label)),
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