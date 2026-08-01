'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveUserProfileAction(
  fullName: string,
  gender: 'M' | 'F' | 'O' | null,
  specialty: string,
  targetExamDate: string | null
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No hay sesión activa');
  }

  // Usar upsert para crear o actualizar en una sola operación
  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: user.id,
      full_name: fullName,
      gender: gender || null,
      specialty,
      target_exam_date: targetExamDate || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}
