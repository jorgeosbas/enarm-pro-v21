import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchAllPages, fetchOptionsByQuestionIds, groupOptionsByQuestion } from '@/lib/supabase/fetchAll';

export interface QuestionWithOptions {
  id: string;
  sequence_number: number | null;
  theme_id: string | null;
  subcategory_id: string;
  difficulty: string;
  vignette: string;
  explanation: string | null;
  options: Array<{
    id: string;
    label: string;
    content: string;
    is_correct: boolean;
  }>;
  subcategory?: {
    id: string;
    name: string;
    specialty?: {
      id: string;
      name: string;
      code: string;
    };
  };
  theme?: {
    id: string;
    name: string;
  } | null;
}

export function useQuestions(subcategoryId?: string | null) {
  return useQuery({
    queryKey: ['questions', subcategoryId],
    queryFn: async () => {
      const supabase = createClient();

      // La consulta se arma dentro de una función para poder repetirla por
      // páginas (Supabase devuelve máx. 1000 filas por consulta).
      const buildQuery = (from: number, to: number) => {
        let query = supabase
        .from('questions')
        .select(
          `
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
            specialty:specialties(id, name, code)
          ),
          theme:themes(id, name)
        `
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

        if (subcategoryId) {
          query = query.eq('subcategory_id', subcategoryId);
        }

        return query.range(from, to);
      };

      const questions = await fetchAllPages(buildQuery);

      if (questions.length === 0) return [];

      const questionIds = (questions as any[]).map((q: any) => q.id);

      // Opciones en grupos de 100 ids y paginadas (límite de 1000 filas)
      const optionsByQuestion = groupOptionsByQuestion(
        await fetchOptionsByQuestionIds(supabase, questionIds)
      );

      return questions.map((q: any) => ({
        ...q,
        options: optionsByQuestion.get(q.id) ?? [],
      })) as QuestionWithOptions[];
    },
  });
}