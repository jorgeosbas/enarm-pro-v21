'use server';

import { createClient } from '@/lib/supabase/server';

export type QuestionDifficulty = 'facil' | 'media' | 'dificil';

export interface UpdateQuestionInput {
  questionId: string;
  vignette: string;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  /** TODAS las opciones de la pregunta (mismas que ya existen: no se agregan ni quitan). */
  options: Array<{ id: string; content: string; isCorrect: boolean }>;
}

export type UpdateQuestionResult =
  | { success: true }
  | { success: false; error: string };

const VALID_DIFFICULTIES: QuestionDifficulty[] = ['facil', 'media', 'dificil'];
const MAX_TEXT_LENGTH = 20000;

/**
 * Edita una pregunta del banco: enunciado, explicación, dificultad y el
 * texto / respuesta correcta de cada opción.
 *
 * Banco Compartido: igual que eliminar, cualquier usuario autenticado puede
 * editar cualquier pregunta, y el cambio lo ve todo el grupo.
 *
 * Detalles importantes:
 *  - Las opciones se actualizan EN SU LUGAR (mismo id). Las respuestas ya
 *    guardadas en answer_logs apuntan a esos ids; borrar y recrear las
 *    opciones rompería ese historial.
 *  - No se agregan ni se quitan opciones, solo se edita su contenido.
 *  - No toca answer_logs, user_flashcard_progress ni nada de FSRS.
 *  - PostgREST no ofrece transacciones: si algo falla a la mitad, se
 *    intentan devolver los cambios ya hechos a como estaban.
 *  - Cada UPDATE pide de vuelta la fila (.select) porque, si la base de
 *    datos bloquea el cambio por permisos, no da error: simplemente cambia
 *    0 filas. Sin esa comprobación se vería "guardado" sin haberse guardado.
 */
export async function updateQuestionAction(
  input: UpdateQuestionInput
): Promise<UpdateQuestionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'No hay sesión activa.' };
  }

  // ── 1. Validar lo que llegó ──────────────────────────────────────────
  const vignette = (input.vignette ?? '').trim();
  const explanation = (input.explanation ?? '').trim();

  if (!vignette) {
    return { success: false, error: 'La pregunta no puede estar vacía.' };
  }
  if (vignette.length > MAX_TEXT_LENGTH || explanation.length > MAX_TEXT_LENGTH) {
    return { success: false, error: 'El texto es demasiado largo.' };
  }
  if (!VALID_DIFFICULTIES.includes(input.difficulty)) {
    return { success: false, error: 'Dificultad no válida.' };
  }
  if (!Array.isArray(input.options) || input.options.length < 2) {
    return { success: false, error: 'La pregunta debe tener al menos 2 opciones.' };
  }

  const cleanedOptions = input.options.map((o) => ({
    id: o.id,
    content: (o.content ?? '').trim(),
    isCorrect: !!o.isCorrect,
  }));

  if (cleanedOptions.some((o) => !o.content)) {
    return { success: false, error: 'Ninguna opción puede quedar vacía.' };
  }
  if (cleanedOptions.some((o) => o.content.length > MAX_TEXT_LENGTH)) {
    return { success: false, error: 'El texto de una opción es demasiado largo.' };
  }
  if (cleanedOptions.filter((o) => o.isCorrect).length !== 1) {
    return { success: false, error: 'Debe haber exactamente una opción correcta.' };
  }

  // ── 2. Leer el estado actual (para validar y para poder deshacer) ────
  const { data: currentQuestion, error: questionReadError } = await (supabase as any)
    .from('questions')
    .select('id, vignette, explanation, difficulty')
    .eq('id', input.questionId)
    .maybeSingle();

  if (questionReadError) {
    console.error('[updateQuestionAction] Error al leer la pregunta:', questionReadError);
    return { success: false, error: questionReadError.message };
  }
  if (!currentQuestion) {
    return { success: false, error: 'La pregunta ya no existe (quizá la eliminaron).' };
  }

  const { data: currentOptionsRaw, error: optionsReadError } = await (supabase as any)
    .from('question_options')
    .select('id, content, is_correct')
    .eq('question_id', input.questionId);

  if (optionsReadError) {
    console.error('[updateQuestionAction] Error al leer las opciones:', optionsReadError);
    return { success: false, error: optionsReadError.message };
  }

  const currentOptions = (currentOptionsRaw ?? []) as Array<{
    id: string;
    content: string;
    is_correct: boolean;
  }>;

  const currentById = new Map(currentOptions.map((o) => [o.id, o]));
  const sameOptionSet =
    currentOptions.length === cleanedOptions.length &&
    cleanedOptions.every((o) => currentById.has(o.id));

  if (!sameOptionSet) {
    return {
      success: false,
      error: 'Las opciones de esta pregunta cambiaron mientras la editabas. Ciérrala y vuelve a abrirla.',
    };
  }

  // ── 3. Aplicar cambios (opciones primero, luego la pregunta) ─────────
  const appliedOptionIds: string[] = [];

  async function rollback() {
    for (const optionId of appliedOptionIds) {
      const original = currentById.get(optionId);
      if (!original) continue;
      const { error } = await (supabase as any)
        .from('question_options')
        .update({ content: original.content, is_correct: original.is_correct })
        .eq('id', optionId)
        .eq('question_id', input.questionId);
      if (error) {
        console.error('[updateQuestionAction] No se pudo deshacer una opción:', optionId, error);
      }
    }
  }

  for (const option of cleanedOptions) {
    const original = currentById.get(option.id)!;
    if (original.content === option.content && original.is_correct === option.isCorrect) {
      continue; // sin cambios
    }

    const { data: updatedRows, error } = await (supabase as any)
      .from('question_options')
      .update({ content: option.content, is_correct: option.isCorrect })
      .eq('id', option.id)
      .eq('question_id', input.questionId)
      .select('id');

    if (error || !updatedRows || updatedRows.length !== 1) {
      console.error('[updateQuestionAction] Falló la actualización de una opción:', option.id, error);
      await rollback();
      return {
        success: false,
        error: error?.message ?? 'No se pudo guardar una opción (sin permiso o ya no existe).',
      };
    }
    appliedOptionIds.push(option.id);
  }

  const { data: updatedQuestionRows, error: questionUpdateError } = await (supabase as any)
    .from('questions')
    .update({
      vignette,
      explanation: explanation || null,
      difficulty: input.difficulty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.questionId)
    .select('id');

  if (questionUpdateError || !updatedQuestionRows || updatedQuestionRows.length !== 1) {
    console.error('[updateQuestionAction] Falló la actualización de la pregunta:', questionUpdateError);
    await rollback();
    return {
      success: false,
      error: questionUpdateError?.message ?? 'No se pudo guardar la pregunta (sin permiso o ya no existe).',
    };
  }

  return { success: true };
}
