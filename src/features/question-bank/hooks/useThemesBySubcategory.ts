import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface Theme {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
}

export function useThemesBySubcategory(subcategoryId: string | null) {
  return useQuery({
    queryKey: ['themes', subcategoryId],
    queryFn: async () => {
      if (!subcategoryId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from('themes')
        .select('id, name, description, created_at')
        .eq('subcategory_id', subcategoryId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!subcategoryId,
  });
}
