import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  gender: 'M' | 'F' | 'O' | null;
  specialty: string | null;
  target_exam_date: string | null;
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('No hay sesión');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Si no existe el perfil, retorna null (no es error)
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as UserProfile;
    },
  });
}
