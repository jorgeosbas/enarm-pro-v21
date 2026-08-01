'use server';

import { createClient } from '@/lib/supabase/server';

export async function deleteQuestionAction(questionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No hay sesión activa.' };
  }

  // Banco Compartido: cualquier usuario autenticado puede borrar cualquier
  // pregunta del banco, no solo las que él mismo importó.
  const { error } = await (supabase as any)
    .from('questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('Error deleting question:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
