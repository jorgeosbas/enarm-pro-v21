import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/**
 * Trae SOLO los IDs de preguntas marcadas (sin datos de la pregunta) — es
 * la consulta liviana que usa <FlagQuestionButton /> en las 6 pantallas
 * para saber si debe pintarse como "marcada" o no.
 *
 * Es una sola query compartida entre todos los botones de la pantalla
 * (React Query la cachea por queryKey), no una consulta por pregunta.
 */
export function useFlaggedQuestionIds() {
  return useQuery({
    queryKey: ['flaggedQuestionIds'],
    queryFn: async (): Promise<Set<string>> => {
      const supabase = createClient();

      const { data, error } = await (supabase as any)
        .from('flagged_questions')
        .select('question_id');

      if (error) throw error;

      return new Set((data ?? []).map((row: any) => row.question_id as string));
    },
    staleTime: 30_000,
  });
}
