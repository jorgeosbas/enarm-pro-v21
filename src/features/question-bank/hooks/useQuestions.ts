import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

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
        .order('created_at', { ascending: false });

      if (subcategoryId) {
        query = query.eq('subcategory_id', subcategoryId);
      }

      const { data: questions, error: questionsError } = await query;

      if (questionsError) throw questionsError;

      if (!questions || questions.length === 0) return [];

      const questionIds = (questions as any[]).map((q: any) => q.id);

      const { data: options, error: optionsError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (optionsError) throw optionsError;

      return questions.map((q: any) => ({
        ...q,
        options: (options || [])
          .filter((opt: any) => opt.question_id === q.id)
          .sort((a: any, b: any) => a.label.localeCompare(b.label)),
      })) as QuestionWithOptions[];
    },
  });
}