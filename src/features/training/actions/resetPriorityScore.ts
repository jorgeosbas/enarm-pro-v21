'use server';

/**
 * resetPriorityScoreAction
 *
 * Borra el historial de respuestas del usuario (answer_logs), lo cual resetea
 * todos los datos que usa el Priority Score del Entrenamiento Inteligente:
 *   - Rendimiento por tema (% de aciertos)
 *   - Último intento por pregunta
 *   - Estadísticas del dashboard (aciertos 24h, racha*)
 *
 * IMPORTANTE:
 * - Esta action NO toca user_flashcard_progress ni ningún dato de FSRS.
 * - El módulo de Flashcards queda completamente intacto.
 * - La racha de días puede verse afectada porque depende de answer_logs,
 *   pero eso es intencional: es parte del "progreso" que se reinicia.
 */

import { createClient } from '@/lib/supabase/server';

export async function resetPriorityScoreAction() {
  try {
    const supabase = await createClient();

    // 0. Obtener usuario autenticado
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      console.error('❌ Usuario no autenticado:', authError);
      return { success: false, message: 'Usuario no autenticado', deletedCount: 0 };
    }

    const userId = authData.user.id;

    // 1. Contar cuántos registros hay antes de borrar (para el mensaje)
    const { count, error: countError } = await supabase
      .from('answer_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('❌ Error contando answer_logs:', countError);
      return { success: false, message: 'Error al acceder al historial', deletedCount: 0 };
    }

    const totalRecords = count || 0;

    if (totalRecords === 0) {
      return {
        success: true,
        message: 'No hay historial de respuestas para reiniciar',
        deletedCount: 0,
      };
    }

    // 2. Borrar TODOS los answer_logs del usuario
    //    (solo los suyos, gracias a RLS + filtro explícito)
    const { error: deleteError } = await supabase
      .from('answer_logs')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error borrando answer_logs:', deleteError);
      return {
        success: false,
        message: `Error al reiniciar: ${deleteError.message}`,
        deletedCount: 0,
      };
    }


    return {
      success: true,
      message: `Historial reiniciado — ${totalRecords} respuestas eliminadas`,
      deletedCount: totalRecords,
    };
  } catch (error) {
    console.error('❌ resetPriorityScoreAction error:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, message: `Error: ${msg}`, deletedCount: 0 };
  }
}