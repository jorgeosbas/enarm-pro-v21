'use server';

import { createClient } from '@/lib/supabase/server';

export async function createSubcategoryAction(
  specialtyId: string,
  name: string,
  description?: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No hay sesión activa');
  }

  const { data, error } = await supabase
    .from('subcategories')
    .insert({
      user_id: user.id,
      specialty_id: specialtyId,
      name,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Violación de unique constraint
      throw new Error(`Ya existe una subcategoría llamada "${name}" en esta especialidad`);
    }
    throw error;
  }

  return data;
}
