'use server';

import { createClient } from '@/lib/supabase/server';

export async function createThemeAction(
  subcategoryId: string,
  themeName: string,
  description?: string
): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No hay sesión activa.' };
  }

  // Banco Compartido: solo se verifica que la subcategoría exista (puede
  // haber sido creada por cualquier amigo), ya no que le pertenezca a
  // quien está creando el tema.
  const { data: subcategoryCheck, error: subcatError } = await supabase
    .from('subcategories')
    .select('id')
    .eq('id', subcategoryId)
    .single();

  if (subcatError || !subcategoryCheck) {
    return { success: false, error: 'Subcategoría no válida o no encontrada.' };
  }

  const { data: theme, error: createError } = await supabase
    .from('themes')
    .insert({
      user_id: user.id,
      subcategory_id: subcategoryId,
      name: themeName,
      description: description || null,
    })
    .select('id')
    .single();

  if (createError) {
    return {
      success: false,
      error:
        createError.code === 'PGRST116'
          ? `El tema "${themeName}" ya existe en esta subcategoría.`
          : createError.message,
    };
  }

  return { success: true, id: theme.id };
}
