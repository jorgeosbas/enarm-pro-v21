'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { FlashcardRating } from '../types';
import { createCardFromProgress, calculateFSRS, convertRating, getStateString } from '../services/fsrsService';

/**
 * Inicializar SOLO preguntas que NUNCA hayan sido registradas como flashcards
 */
export async function initializeAllFlashcardsAction() {
  try {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      console.error('❌ Usuario no autenticado:', authError);
      return { 
        success: false, 
        message: 'Usuario no autenticado. Por favor, recarga la página.',
        initialized: 0,
      };
    }

    const userId = authData.user.id;
    console.log(`🔍 Inicializando flashcards para usuario: ${userId}`);

    const { data: allQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('id, vignette')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (questionsError) {
      console.error('❌ Error fetching questions:', questionsError);
      return { 
        success: false, 
        message: `Error al obtener preguntas: ${questionsError.message}`,
        initialized: 0,
      };
    }

    const questionCount = allQuestions?.length || 0;

    if (!allQuestions || questionCount === 0) {
      return { 
        success: true, 
        message: 'No hay preguntas importadas todavía',
        initialized: 0,
      };
    }

    const { data: existingProgress, error: progressError } = await supabase
      .from('user_flashcard_progress')
      .select('question_id')
      .eq('user_id', userId);

    if (progressError) {
      console.error('❌ Error fetching progress:', progressError);
      return { 
        success: false, 
        message: `Error al verificar progreso: ${progressError.message}`,
        initialized: 0,
      };
    }

    const existingQuestionIds = new Set(
      (existingProgress || []).map((p: any) => p.question_id)
    );
    const questionsToInitialize = (allQuestions || []).filter(
      (q: any) => !existingQuestionIds.has(q.id)
    );

    const toInitializeCount = questionsToInitialize.length;

    if (toInitializeCount === 0) {
      return { 
        success: true, 
        message: 'Todas las preguntas ya están sincronizadas',
        initialized: 0,
      };
    }

    const now = new Date();
    const dueDate = new Date(now.getTime() - 60 * 60 * 1000);
    const flashcardsToCreate = questionsToInitialize.map((q: any) => ({
      user_id: userId,
      question_id: q.id,
      stability: 1.0,
      difficulty: 5.0,
      elapsed_days: 0,
      scheduled_days: 1,
      reps: 0,
      lapses: 0,
      state: 'new',
      last_review: null,
      due_date: dueDate.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));

    const { data: created, error: createError } = await supabase
      .from('user_flashcard_progress')
      .insert(flashcardsToCreate)
      .select('id, question_id');

    if (createError) {
      console.error('❌ Error creating flashcards:', createError);
      return { 
        success: false, 
        message: `Error al crear flashcards: ${createError.message}`,
        initialized: 0,
      };
    }

    const createdCount = created?.length || 0;

    // Purga el cache de las páginas afectadas
    revalidatePath('/flashcards');
    revalidatePath('/dashboard');

    return { 
      success: true, 
      message: 
        createdCount > 0
          ? `✨ Se inicializaron ${createdCount} nuevas preguntas como flashcards`
          : 'Flashcards listas',
      initialized: createdCount,
    };
  } catch (error) {
    console.error('❌ initializeAllFlashcardsAction error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return { 
      success: false, 
      message: `Error al inicializar: ${errorMsg}`,
      initialized: 0,
    };
  }
}

/**
 * Actualizar progreso de una flashcard al calificarla
 */
export async function updateFlashcardProgressAction(
  questionId: string,
  rating: FlashcardRating
) {
  try {
    const supabase = await createClient();

    // 1. Validar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[updateFlashcardProgressAction] Error de autenticación:', authError);
      return { success: false, error: 'session_expired', message: 'Sesión expirada' };
    }

    // 2. Obtener la tarjeta/progreso existente
    const { data: progress, error: fetchError } = await supabase
      .from('user_flashcard_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (fetchError) {
      console.error('[updateFlashcardProgressAction] Error al buscar progreso:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // 3. Estructura base si es nueva
    const now = new Date();
    const currentProgress = progress || {
      question_id: questionId,
      user_id: user.id,
      stability: 1.0,
      difficulty: 5.0,
      elapsed_days: 0,
      scheduled_days: 1,
      reps: 0,
      lapses: 0,
      state: 'new',
      due_date: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    };

    // 4. Convertir a Card y calcular FSRS
    const card = createCardFromProgress(currentProgress);
    const fsrsRating = convertRating(rating);
    const fsrsResult = calculateFSRS(card, fsrsRating, now);

    const updatedCard = fsrsResult.card;

    // 5. Sanitización estricta de valores numéricos para evitar violaciones NOT NULL en Supabase
    const stability = Number.isFinite(updatedCard?.stability)
      ? updatedCard.stability
      : (currentProgress.stability ?? 1.0);

    const difficulty = Number.isFinite(updatedCard?.difficulty)
      ? updatedCard.difficulty
      : (currentProgress.difficulty ?? 5.0);

    const elapsedDays = Number.isFinite(updatedCard?.elapsed_days)
      ? updatedCard.elapsed_days
      : 0;

    const scheduledDays = Number.isFinite(updatedCard?.scheduled_days)
      ? updatedCard.scheduled_days
      : 1;

    const reps = Number.isFinite(updatedCard?.reps)
      ? updatedCard.reps
      : 0;

    const lapses = Number.isFinite(updatedCard?.lapses)
      ? updatedCard.lapses
      : 0;

    // 6. Sanitización de Fecha: Evita el error "Invalid time value"
    const rawDue = updatedCard?.due ? new Date(updatedCard.due) : new Date();
    const validDueDate = !isNaN(rawDue.getTime()) ? rawDue : new Date();

    // 7. Guardar o actualizar en Supabase
    const { error: updateError } = await supabase
      .from('user_flashcard_progress')
      .upsert({
        user_id: user.id,
        question_id: questionId,
        stability: stability,
        difficulty: difficulty,
        elapsed_days: elapsedDays,
        scheduled_days: scheduledDays,
        reps: reps,
        lapses: lapses,
        state: getStateString(updatedCard?.state),
        last_review: now.toISOString(),
        due_date: validDueDate.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id,question_id' });

    if (updateError) {
      console.error('[updateFlashcardProgressAction] Error en Upsert:', updateError);
      return { success: false, error: updateError.message };
    }

    // 8. Revalidación inmediata de la caché de Next.js
    revalidatePath('/flashcards');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('[updateFlashcardProgressAction] Unhandled Exception:', error);
    return { success: false, error: error?.message || 'Error desconocido' };
  }
}

/**
 * Inicializar un flashcard individual
 */
export async function initializeFlashcardAction(questionId: string) {
  try {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      console.error('❌ Usuario no autenticado:', authError);
      throw new Error('Usuario no autenticado');
    }

    const userId = authData.user.id;

    const { data: existing } = await supabase
      .from('user_flashcard_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .single();

    if (existing) {
      return existing;
    }

    const now = new Date();
    const dueDate = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: created, error } = await supabase
      .from('user_flashcard_progress')
      .insert({
        user_id: userId,
        question_id: questionId,
        stability: 1.0,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 0,
        lapses: 0,
        state: 'new',
        last_review: null,
        due_date: dueDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error initializing flashcard:', error);
      throw error;
    }

    revalidatePath('/flashcards');
    revalidatePath('/dashboard');

    return created;
  } catch (error) {
    console.error('❌ initializeFlashcardAction error:', error);
    throw error;
  }
}

/**
 * Reiniciar TODAS las estadísticas de flashcards del usuario
 */
export async function resetAllFlashcardsProgressAction() {
  try {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      console.error('❌ Usuario no autenticado:', authError);
      throw new Error('Usuario no autenticado');
    }

    const userId = authData.user.id;

    const { data: allFlashcards, error: fetchError } = await supabase
      .from('user_flashcard_progress')
      .select('id')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('❌ Error fetching flashcards:', fetchError);
      throw new Error('Error al obtener flashcards');
    }

    if (!allFlashcards || allFlashcards.length === 0) {
      return {
        success: true,
        message: 'No hay flashcards para reiniciar',
        resetCount: 0,
      };
    }

    const now = new Date();
    const dueDate = new Date(now.getTime() - 60 * 60 * 1000);
    const resetData = {
      stability: 1.0,
      difficulty: 5.0,
      elapsed_days: 0,
      scheduled_days: 1,
      reps: 0,
      lapses: 0,
      state: 'new',
      last_review: null,
      due_date: dueDate.toISOString(),
      updated_at: now.toISOString(),
    };

    const { error: updateError } = await supabase
      .from('user_flashcard_progress')
      .update(resetData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error resetting flashcards:', updateError);
      throw new Error(`Error al reiniciar: ${updateError.message}`);
    }

    const resetCount = allFlashcards.length;

    revalidatePath('/flashcards');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `✨ Se reiniciaron ${resetCount} flashcards correctamente`,
      resetCount,
    };
  } catch (error) {
    console.error('❌ resetAllFlashcardsProgressAction error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return {
      success: false,
      message: `Error al reiniciar: ${errorMsg}`,
      resetCount: 0,
    };
  }
}