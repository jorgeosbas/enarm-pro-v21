import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface FlaggedQuestion {
  flagId: string;
  questionId: string;
  flaggedAt: string;
  vignette: string;
  difficulty: string;
  specialtyName: string | null;
  subcategoryName: string | null;
  themeName: string | null;
}

/**
 * Lista completa de preguntas marcadas, con los datos necesarios para
 * mostrarlas en Configuración → Preguntas marcadas (viñeta, tema, etc.).
 * Más pesada que useFlaggedQuestionIds a propósito — esta solo se usa en
 * una pantalla, no en las 6 donde se estudia.
 */
export function useFlaggedQuestions() {
  return useQuery({
    queryKey: ['flaggedQuestions'],
    queryFn: async (): Promise<FlaggedQuestion[]> => {
      const supabase = createClient();

      const { data, error } = await (supabase as any)
        .from('flagged_questions')
        .select(
          `
          id,
          question_id,
          created_at,
          question:questions (
            id,
            vignette,
            difficulty,
            subcategory:subcategories (
              name,
              specialty:specialties ( name )
            ),
            theme:themes ( name )
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        flagId: row.id,
        questionId: row.question_id,
        flaggedAt: row.created_at,
        vignette: row.question?.vignette ?? '(pregunta eliminada)',
        difficulty: row.question?.difficulty ?? 'media',
        specialtyName: row.question?.subcategory?.specialty?.name ?? null,
        subcategoryName: row.question?.subcategory?.name ?? null,
        themeName: row.question?.theme?.name ?? null,
      })) as FlaggedQuestion[];
    },
    staleTime: 10_000,
  });
}
