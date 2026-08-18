'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Marca o desmarca una pregunta para revisión posterior.
 *
 * Es un toggle: si la pregunta ya está marcada, la desmarca (borra la fila);
 * si no lo está, la marca (crea la fila). Global al banco compartido — no
 * importa quién la marcó originalmente, cualquier usuario puede desmarcarla
 * (por ejemplo, si no está de acuerdo con la marca de otro compañero).
 *
 * No dispara ningún otro efecto: no toca answer_logs, user_flashcard_progress
 * ni ninguna otra tabla. Es una acción aislada, a propósito.
 */
export async function toggleFlagQuestionAction(questionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No hay sesión activa.', flagged: false };
  }

  const { data: existing, error: checkError } = await (supabase as any)
    .from('flagged_questions')
    .select('id')
    .eq('question_id', questionId)
    .maybeSingle();

  if (checkError) {
    console.error('Error al revisar si la pregunta ya está marcada:', checkError);
    return { success: false, error: checkError.message, flagged: false };
  }

  if (existing) {
    // Ya estaba marcada → desmarcar
    const { error: deleteError } = await (supabase as any)
      .from('flagged_questions')
      .delete()
      .eq('question_id', questionId);

    if (deleteError) {
      console.error('Error al desmarcar la pregunta:', deleteError);
      return { success: false, error: deleteError.message, flagged: true };
    }

    return { success: true, flagged: false };
  }

  // No estaba marcada → marcar
  const { error: insertError } = await (supabase as any)
    .from('flagged_questions')
    .insert({ question_id: questionId, flagged_by_user_id: user.id });

  if (insertError) {
    console.error('Error al marcar la pregunta:', insertError);
    return { success: false, error: insertError.message, flagged: false };
  }

  return { success: true, flagged: true };
}
