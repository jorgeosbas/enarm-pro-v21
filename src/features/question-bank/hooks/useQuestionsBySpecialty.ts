import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface QuestionForStudy {
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
    };
  };
  theme?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Hook para traer preguntas por especialidad
 */
export function useQuestionsBySpecialty(specialtyId: string | null) {
  return useQuery({
    queryKey: ['questionsBySpecialty', specialtyId],
    queryFn: async () => {
      if (!specialtyId) return [];

      const supabase = createClient();

      // Traer todas las subcategorías de esta especialidad
      const { data: subcats, error: subcatsError } = await supabase
        .from('subcategories')
        .select('id')
        .eq('specialty_id', specialtyId);

      if (subcatsError || !subcats) return [];

      const subcatIds = (subcats as any[]).map((s: any) => s.id);

      // Traer todas las preguntas de estas subcategorías
      const { data: questions, error: questionsError } = await supabase
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
            specialty:specialties(id, name)
          ),
          theme:themes(id, name)
        `
        )
        .in('subcategory_id', subcatIds)
        .order('created_at', { ascending: false });

      if (questionsError || !questions) return [];

      const questionIds = (questions as any[]).map((q: any) => q.id);

      // Traer opciones (solo de las preguntas obtenidas arriba)
      const { data: options, error: optionsError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (optionsError) return [];

      return questions
        .map((q: any) => ({
          ...q,
          options: (options || [])
            .filter((opt: any) => opt.question_id === q.id)
            .sort((a: any, b: any) => a.label.localeCompare(b.label)),
        }))
        .sort(() => Math.random() - 0.5) as QuestionForStudy[];
    },
    enabled: !!specialtyId,
  });
}