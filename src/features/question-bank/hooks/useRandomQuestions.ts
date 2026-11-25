import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchAllPages, fetchOptionsByQuestionIds, groupOptionsByQuestion } from '@/lib/supabase/fetchAll';

export interface RandomQuestion {
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
 * Hook para traer preguntas al azar de una subcategoría específica
 */
export function useRandomQuestionsFromSubcategory(subcategoryId: string | null) {
  return useQuery({
    queryKey: ['randomQuestions', subcategoryId],
    queryFn: async () => {
      if (!subcategoryId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
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
        .eq('subcategory_id', subcategoryId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      const questionIds = (data as any[]).map((q: any) => q.id);

      // Opciones en grupos de 100 ids y paginadas (límite de 1000 filas)
      const optionsByQuestion = groupOptionsByQuestion(
        await fetchOptionsByQuestionIds(supabase, questionIds)
      );

      return data
        .map((q: any) => ({
          ...q,
          options: optionsByQuestion.get(q.id) ?? [],
        }))
        .sort(() => Math.random() - 0.5) as RandomQuestion[];
    },
    enabled: !!subcategoryId,
    // La lista de preguntas de un cuestionario debe quedarse FIJA mientras
    // lo estás contestando. Antes, al salir de la app un rato y volver (o al
    // reconectarse el celular), React Query volvía a pedir las preguntas y,
    // como se barajan al azar, la lista cambiaba a media sesión y te salía
    // otra pregunta distinta a la que dejaste.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook para traer preguntas al azar de TODAS las subcategorías del usuario
 */
export function useRandomQuestionsFromAll() {
  return useQuery({
    queryKey: ['randomQuestionsAll'],
    queryFn: async () => {
      const supabase = createClient();

      const data = await fetchAllPages((from, to) =>
        supabase
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
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
      );

      if (!data || data.length === 0) return [];

      const questionIds = (data as any[]).map((q: any) => q.id);

      // Opciones en grupos de 100 ids y paginadas (límite de 1000 filas)
      const optionsByQuestion = groupOptionsByQuestion(
        await fetchOptionsByQuestionIds(supabase, questionIds)
      );

      return data
        .map((q: any) => ({
          ...q,
          options: optionsByQuestion.get(q.id) ?? [],
        }))
        .sort(() => Math.random() - 0.5) as RandomQuestion[];
    },
    // La lista de preguntas de un cuestionario debe quedarse FIJA mientras
    // lo estás contestando. Antes, al salir de la app un rato y volver (o al
    // reconectarse el celular), React Query volvía a pedir las preguntas y,
    // como se barajan al azar, la lista cambiaba a media sesión y te salía
    // otra pregunta distinta a la que dejaste.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}