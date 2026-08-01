'use server';

import { createClient } from '@/lib/supabase/server';

export async function recordAnswerAction(
  questionId: string,
  selectedOptionId: string,
  isCorrect: boolean
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado.');
  }

  const { error } = await (supabase as any).from('answer_logs').insert({
    user_id: user.id,
    question_id: questionId,
    selected_option_id: selectedOptionId,
    is_correct: isCorrect,
  });

  if (error) {
    console.error('Error al registrar respuesta:', error);
    throw new Error('No se pudo registrar la respuesta.');
  }

  return { success: true };
}