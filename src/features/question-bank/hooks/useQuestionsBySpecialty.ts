import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchAllPages, fetchOptionsByQuestionIds, groupOptionsByQuestion } from '@/lib/supabase/fetchAll';

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

      // Traer opciones (solo de las preguntas obtenidas arriba), en grupos
      // de 100 ids y paginadas (límite de 1000 filas por consulta)
      let optionsByQuestion;
      try {
        optionsByQuestion = groupOptionsByQuestion(
          await fetchOptionsByQuestionIds(supabase, questionIds)
        );
      } catch {
        return [];
      }

      return questions
        .map((q: any) => ({
          ...q,
          options: optionsByQuestion.get(q.id) ?? [],
        }))
        .sort(() => Math.random() - 0.5) as QuestionForStudy[];
    },
    enabled: !!specialtyId,
    // La lista de preguntas de un cuestionario debe quedarse FIJA mientras
    // lo estás contestando. Antes, al salir de la app un rato y volver (o al
    // reconectarse el celular), React Query volvía a pedir las preguntas y,
    // como se barajan al azar, la lista cambiaba a media sesión y te salía
    // otra pregunta distinta a la que dejaste.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}