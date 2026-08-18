'use client';

import { Flag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFlaggedQuestionIds } from '@/features/question-bank/hooks/useFlaggedQuestionIds';
import { toggleFlagQuestionAction } from '@/features/question-bank/actions/flagQuestion';

interface FlagQuestionButtonProps {
  questionId: string;
  /** Clases para posicionar el botón — cada pantalla lo acomoda donde le convenga. */
  className?: string;
}

/**
 * Botón de "marcar pregunta para revisión". Vive en las 6 pantallas donde
 * se ve una pregunta (Por Tema ×2, Simulador, Entrenamiento, pregunta
 * individual, Flashcards) y también junto a cada fila en Configuración →
 * Preguntas marcadas.
 *
 * A propósito NO hace nada más que cambiar su propio ícono: sin popups,
 * sin confirmaciones, sin mover el resto de la interfaz. Un toque marca o
 * desmarca; el resto de la pantalla de estudio sigue exactamente igual.
 */
export function FlagQuestionButton({ questionId, className = '' }: FlagQuestionButtonProps) {
  const queryClient = useQueryClient();
  const { data: flaggedIds } = useFlaggedQuestionIds();
  const isFlagged = flaggedIds?.has(questionId) ?? false;

  const { mutate, isPending } = useMutation({
    mutationFn: () => toggleFlagQuestionAction(questionId),

    // Optimista: el ícono cambia al instante, sin esperar la respuesta del
    // servidor — se siente inmediato, que es justo el punto de un botón
    // que "no debe interferir" con el flujo de estudio.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['flaggedQuestionIds'] });
      const previous = queryClient.getQueryData<Set<string>>(['flaggedQuestionIds']);

      queryClient.setQueryData<Set<string>>(['flaggedQuestionIds'], (old: Set<string> | undefined) => {
        const next = new Set(old ?? []);
        if (next.has(questionId)) {
          next.delete(questionId);
        } else {
          next.add(questionId);
        }
        return next;
      });

      return { previous };
    },

    onError: (
      _err: unknown,
      _vars: void,
      context: { previous: Set<string> | undefined } | undefined
    ) => {
      // Si falló, regresamos el ícono a como estaba — sin alert ni popup,
      // el único indicio es que el ícono "rebota" a su estado anterior.
      if (context?.previous) {
        queryClient.setQueryData(['flaggedQuestionIds'], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['flaggedQuestionIds'] });
      queryClient.invalidateQueries({ queryKey: ['flaggedQuestions'] });
    },
  });

  return (
    <button
      type="button"
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        mutate();
      }}
      disabled={isPending}
      title={isFlagged ? 'Quitar marca de revisión' : 'Marcar para revisión'}
      aria-pressed={isFlagged}
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
        isFlagged
          ? 'text-amber-500 hover:bg-amber-100/60 dark:text-amber-400 dark:hover:bg-amber-500/10'
          : 'text-slate-400 hover:bg-slate-100/60 hover:text-slate-600 dark:text-white/25 dark:hover:bg-white/[0.06] dark:hover:text-white/50'
      } ${className}`}
    >
      <Flag className="h-4 w-4" fill={isFlagged ? 'currentColor' : 'none'} />
    </button>
  );
}
