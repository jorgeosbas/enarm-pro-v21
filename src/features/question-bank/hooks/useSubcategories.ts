import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SubcategoryWithSpecialty } from '../types/categories';

export function useSubcategories() {
  return useQuery({
    queryKey: ['subcategories'],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('subcategories')
        .select(
          `
          id,
          user_id,
          specialty_id,
          name,
          description,
          created_at,
          specialty:specialties(id, name, code)
        `
        )
        .order('name');

      if (error) throw error;
      return data as SubcategoryWithSpecialty[];
    },
  });
}

/**
 * Hook para traer subcategorías de una especialidad específica
 */
export function useSubcategoriesBySpecialty(specialtyId: string | null) {
  return useQuery({
    queryKey: ['subcategories', specialtyId],
    queryFn: async () => {
      if (!specialtyId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('specialty_id', specialtyId)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!specialtyId,
  });
}
