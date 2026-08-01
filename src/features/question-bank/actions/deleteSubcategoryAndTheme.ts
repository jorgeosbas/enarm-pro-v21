'use server';

import { createClient } from '@/lib/supabase/server';

export async function deleteSubcategoryAction(subcategoryId: string): Promise<{
  success: boolean;
  questionCount?: number;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No hay sesión activa.' };
  }

  // Banco Compartido: solo se verifica que la subcategoría exista, ya no
  // que le pertenezca a quien la está borrando.
  const { data: subcategory, error: fetchError } = await supabase
    .from('subcategories')
    .select('id')
    .eq('id', subcategoryId)
    .single();

  if (fetchError || !subcategory) {
    return { success: false, error: 'Subcategoría no encontrada.' };
  }

  // Contar cuántas preguntas se van a eliminar (del banco completo, no solo las del usuario)
  const { count: questionCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact' })
    .eq('subcategory_id', subcategoryId);

  // Eliminar (cascade elimina preguntas, opciones y temas)
  const { error: deleteError } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', subcategoryId);

  if (deleteError) {
    return { success: false, error: `Error al eliminar: ${deleteError.message}` };
  }

  return { success: true, questionCount: questionCount || 0 };
}

export async function deleteThemeAction(themeId: string): Promise<{
  success: boolean;
  questionCount?: number;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No hay sesión activa.' };
  }

  // Banco Compartido: solo se verifica que el tema exista, ya no que le
  // pertenezca a quien lo está borrando.
  const { data: theme, error: fetchError } = await supabase
    .from('themes')
    .select('id')
    .eq('id', themeId)
    .single();

  if (fetchError || !theme) {
    return { success: false, error: 'Tema no encontrado.' };
  }

  // Contar cuántas preguntas se van a eliminar (del banco completo, no solo las del usuario)
  const { count: questionCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact' })
    .eq('theme_id', themeId);

  // Eliminar (las preguntas van a tener theme_id = null, no se eliminan)
  const { error: deleteError } = await supabase
    .from('themes')
    .delete()
    .eq('id', themeId);

  if (deleteError) {
    return { success: false, error: `Error al eliminar: ${deleteError.message}` };
  }

  return { success: true, questionCount: questionCount || 0 };
}
