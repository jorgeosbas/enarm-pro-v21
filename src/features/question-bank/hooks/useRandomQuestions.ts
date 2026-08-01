import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

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

      const { data: options, error: optionsError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (optionsError) throw optionsError;

      return data
        .map((q: any) => ({
          ...q,
          options: (options || [])
            .filter((opt: any) => opt.question_id === q.id)
            .sort((a: any, b: any) => a.label.localeCompare(b.label)),
        }))
        .sort(() => Math.random() - 0.5) as RandomQuestion[];
    },
    enabled: !!subcategoryId,
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      const questionIds = (data as any[]).map((q: any) => q.id);

      const { data: options, error: optionsError } = await supabase
        .from('question_options')
        .select('id, question_id, label, content, is_correct')
        .in('question_id', questionIds);

      if (optionsError) throw optionsError;

      return data
        .map((q: any) => ({
          ...q,
          options: (options || [])
            .filter((opt: any) => opt.question_id === q.id)
            .sort((a: any, b: any) => a.label.localeCompare(b.label)),
        }))
        .sort(() => Math.random() - 0.5) as RandomQuestion[];
    },
  });
}