'use server';

import { createClient } from '@/lib/supabase/server';
import { parseQuestionsText } from '@/features/question-bank/domain/parseQuestions';

export interface ImportSummary {
  inserted: number;
  failed: number;
  errorMessages: string[];
}

/**
 * Server Action: recibe el texto crudo + subcategoryId + themeId (opcional),
 * lo vuelve a parsear en el servidor y guarda cada pregunta.
 */
export async function importQuestionsAction(
  rawText: string,
  subcategoryId: string,
  themeId?: string | null
): Promise<ImportSummary> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { inserted: 0, failed: 0, errorMessages: ['No hay sesión activa.'] };
  }

  // Validar que la subcategoría pertenece al usuario
  const { data: subcategoryCheck, error: subcatError } = (await supabase
    .from('subcategories')
    .select('id')
    .eq('id', subcategoryId)
    .eq('user_id', user.id)
    .single()) as { data: any; error: any };

  if (subcatError || !subcategoryCheck) {
    return { inserted: 0, failed: 0, errorMessages: ['Subcategoría no válida o no encontrada.'] };
  }

  // Si se proporciona themeId, validar que pertenece al usuario
  if (themeId) {
    const { data: themeCheck, error: themeError } = (await supabase
      .from('themes')
      .select('id')
      .eq('id', themeId)
      .eq('user_id', user.id)
      .eq('subcategory_id', subcategoryId)
      .single()) as { data: any; error: any };

    if (themeError || !themeCheck) {
      return { inserted: 0, failed: 0, errorMessages: ['Tema no válido o no encontrado.'] };
    }
  }

  // Obtener el siguiente sequence_number para este usuario
  const { data: maxSeqData } = (await supabase
    .from('questions')
    .select('sequence_number')
    .eq('user_id', user.id)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single()) as { data: any; error: any };

  let nextSequenceNumber = (maxSeqData?.sequence_number ?? 0) + 1;

  const { questions, errors } = parseQuestionsText(rawText);
  const errorMessages = errors.map((e) => `Pregunta ${e.blockIndex}: ${e.message}`);

  let inserted = 0;

  for (const q of questions) {
    const questionPayload: any = {
      user_id: user.id,
      subcategory_id: subcategoryId,
      theme_id: themeId || null,
      sequence_number: nextSequenceNumber,
      difficulty: q.difficulty,
      vignette: q.vignette,
      explanation: q.explanation ?? null,
    };

    const { data: questionRow, error: questionError } = (await (supabase as any)
      .from('questions')
      .insert(questionPayload)
      .select('id')
      .single()) as { data: any; error: any };

    if (questionError || !questionRow) {
      errorMessages.push(`No se pudo guardar una pregunta: ${questionError?.message}`);
      nextSequenceNumber++;
      continue;
    }

    const optionsPayload = q.options.map((opt, idx) => ({
      question_id: questionRow.id,
      label: opt.label,
      content: opt.content,
      is_correct: opt.isCorrect,
      order_index: idx,
    }));

    const { error: optionsError } = (await (supabase as any)
      .from('question_options')
      .insert(optionsPayload)) as { error: any };

    if (optionsError) {
      errorMessages.push(`Pregunta guardada pero fallaron sus opciones: ${optionsError.message}`);
      nextSequenceNumber++;
      continue;
    }

    inserted++;
    nextSequenceNumber++;
  }

  return { inserted, failed: questions.length - inserted, errorMessages };
}