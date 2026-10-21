'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useFlaggedQuestionIds } from '@/features/question-bank/hooks/useFlaggedQuestionIds';
import {
  updateQuestionAction,
  type QuestionDifficulty,
} from '@/features/question-bank/actions/updateQuestion';
import { toggleFlagQuestionAction } from '@/features/question-bank/actions/flagQuestion';

interface EditableOption {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

interface EditableQuestion {
  id: string;
  vignette: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  options: EditableOption[];
}

interface EditQuestionModalProps {
  /** Id de la pregunta a editar. null = modal cerrado. */
  questionId: string | null;
  onClose: () => void;
}

const DIFFICULTY_LABELS: Array<{ value: QuestionDifficulty; label: string }> = [
  { value: 'facil', label: 'Fácil' },
  { value: 'media', label: 'Media' },
  { value: 'dificil', label: 'Difícil' },
];

/** Pantallas/listas que muestran preguntas: se refrescan al guardar una edición. */
const QUERY_KEYS_TO_REFRESH = [
  'questions',
  'questionsBySpecialty',
  'randomQuestions',
  'randomQuestionsAll',
  'trainingQuestions',
  'dueFlashcards',
  'flaggedQuestions',
  'flaggedQuestionIds',
];

const inp =
  'w-full rounded-xl border border-indigo-300/50 bg-white/75 px-4 py-2.5 text-[13px] leading-relaxed text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';
const lbl =
  'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/35';

async function fetchQuestionForEdit(questionId: string): Promise<EditableQuestion> {
  const supabase = createClient();

  const { data: question, error: questionError } = await (supabase as any)
    .from('questions')
    .select('id, vignette, explanation, difficulty')
    .eq('id', questionId)
    .maybeSingle();

  if (questionError) throw questionError;
  if (!question) throw new Error('La pregunta ya no existe.');

  const { data: options, error: optionsError } = await (supabase as any)
    .from('question_options')
    .select('id, label, content, is_correct, order_index')
    .eq('question_id', questionId);

  if (optionsError) throw optionsError;

  const sorted = ((options ?? []) as any[]).sort(
    (a, b) =>
      (a.order_index ?? 0) - (b.order_index ?? 0) ||
      String(a.label ?? '').localeCompare(String(b.label ?? ''))
  );

  return {
    id: question.id,
    vignette: question.vignette ?? '',
    explanation: question.explanation ?? '',
    difficulty: (question.difficulty ?? 'media') as QuestionDifficulty,
    options: sorted.map((o) => ({
      id: o.id,
      label: o.label,
      content: o.content ?? '',
      isCorrect: !!o.is_correct,
    })),
  };
}

/**
 * Edición de una pregunta del banco, en una ventana encima de la pantalla
 * actual (así el Banco conserva sus filtros y su posición al cerrarla).
 * Se abre desde el Banco y desde Configuración → Preguntas marcadas.
 */
export function EditQuestionModal({ questionId, onClose }: EditQuestionModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!questionId || !mounted) return null;

  return createPortal(<EditQuestionModalContent questionId={questionId} onClose={onClose} />, document.body);
}

function EditQuestionModalContent({
  questionId,
  onClose,
}: {
  questionId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['questionForEdit', questionId],
    queryFn: () => fetchQuestionForEdit(questionId),
    staleTime: 0,
    gcTime: 0,
  });

  // El cierre normal pasa por aquí para preguntar si hay cambios sin guardar.
  const [isDirty, setIsDirty] = useState(false);

  function requestClose() {
    if (isDirty && !confirm('¿Descartar los cambios sin guardar?')) return;
    onClose();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" onClick={requestClose} />
      <div className="pointer-events-none fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className="pointer-events-auto flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-indigo-300/50 bg-white/95 backdrop-blur-xl animate-scale-in dark:border-white/[0.1] dark:bg-[#0f0f1a]/95 sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-indigo-200/50 px-5 py-4 dark:border-white/[0.08]">
            <h2 className="text-[16px] font-medium text-[#1e1b4b] dark:text-white">Editar pregunta</h2>
            <button
              onClick={requestClose}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/70"
              aria-label="Cerrar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoading && (
            <p className="px-5 py-10 text-center text-[13px] text-slate-500 dark:text-white/40">
              Cargando pregunta...
            </p>
          )}

          {error && (
            <div className="px-5 py-8 text-center">
              <p className="mb-4 text-[13px] text-rose-600 dark:text-rose-300">
                No se pudo cargar la pregunta. {error instanceof Error ? error.message : ''}
              </p>
              <button
                onClick={onClose}
                className="rounded-xl border border-indigo-300/50 px-4 py-2 text-[13px] text-slate-700 dark:border-white/[0.1] dark:text-white/70"
              >
                Cerrar
              </button>
            </div>
          )}

          {data && (
            <EditForm
              key={data.id}
              initial={data}
              onDirtyChange={setIsDirty}
              onCancel={requestClose}
              onSaved={onClose}
            />
          )}
        </div>
      </div>
    </>
  );
}

function EditForm({
  initial,
  onDirtyChange,
  onCancel,
  onSaved,
}: {
  initial: EditableQuestion;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: flaggedIds } = useFlaggedQuestionIds();
  const wasFlagged = flaggedIds?.has(initial.id) ?? false;

  const [vignette, setVignette] = useState(initial.vignette);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(initial.difficulty);
  const [options, setOptions] = useState<EditableOption[]>(initial.options);
  const [unflagOnSave, setUnflagOnSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      vignette !== initial.vignette ||
      explanation !== initial.explanation ||
      difficulty !== initial.difficulty ||
      options.some((o, i) => {
        const original = initial.options[i];
        return !original || o.content !== original.content || o.isCorrect !== original.isCorrect;
      }),
    [vignette, explanation, difficulty, options, initial]
  );

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const hasEmptyField = !vignette.trim() || options.some((o) => !o.content.trim());
  const correctCount = options.filter((o) => o.isCorrect).length;
  const canSave = dirty && !hasEmptyField && correctCount === 1 && !saving;

  function updateOptionContent(id: string, content: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, content } : o)));
  }

  function markCorrect(id: string) {
    setOptions((prev) => prev.map((o) => ({ ...o, isCorrect: o.id === id })));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const result = await updateQuestionAction({
        questionId: initial.id,
        vignette,
        explanation: explanation.trim() ? explanation : null,
        difficulty,
        options: options.map((o) => ({ id: o.id, content: o.content, isCorrect: o.isCorrect })),
      });

      if (!result.success) {
        setErrorMsg(result.error);
        return;
      }

      // Quitar la marca de revisión (si la tenía y así se eligió). Se
      // revisa el estado actual justo ahora para no MARCARLA por error si
      // alguien más ya la había desmarcado mientras editabas.
      const flaggedNow =
        queryClient.getQueryData<Set<string>>(['flaggedQuestionIds'])?.has(initial.id) ?? false;
      if (unflagOnSave && flaggedNow) {
        try {
          await toggleFlagQuestionAction(initial.id);
        } catch (err) {
          console.error('[EditQuestionModal] No se pudo quitar la marca:', err);
        }
      }

      await Promise.all(
        QUERY_KEYS_TO_REFRESH.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      );
      onDirtyChange(false);
      onSaved();
    } catch (err) {
      console.error('[EditQuestionModal] Error al guardar:', err);
      setErrorMsg('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div>
          <label className={lbl}>Pregunta</label>
          <textarea
            value={vignette}
            onChange={(e) => setVignette(e.target.value)}
            rows={7}
            className={`${inp} resize-y`}
          />
        </div>

        <div>
          <label className={lbl}>Opciones · toca el círculo para marcar la correcta</label>
          <div className="space-y-2.5">
            {options.map((option) => (
              <div key={option.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => markCorrect(option.id)}
                  className={`mt-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors ${
                    option.isCorrect
                      ? 'border-emerald-400 bg-emerald-500 text-white'
                      : 'border-indigo-300/60 bg-white/70 text-slate-500 hover:border-emerald-400 dark:border-white/[0.15] dark:bg-white/[0.04] dark:text-white/50'
                  }`}
                  title={option.isCorrect ? 'Respuesta correcta' : 'Marcar como correcta'}
                  aria-pressed={option.isCorrect}
                >
                  {option.isCorrect ? '✓' : option.label}
                </button>
                <textarea
                  value={option.content}
                  onChange={(e) => updateOptionContent(option.id, e.target.value)}
                  rows={2}
                  className={`${inp} resize-y ${
                    option.isCorrect ? '!border-emerald-400/70' : ''
                  }`}
                  aria-label={`Opción ${option.label}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className={lbl}>Explicación</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={5}
            placeholder="Sin explicación"
            className={`${inp} resize-y`}
          />
        </div>

        <div>
          <label className={lbl}>Dificultad</label>
          <div className="flex rounded-xl border border-indigo-200/60 bg-indigo-100/45 p-1 dark:border-white/[0.06] dark:bg-white/[0.03]">
            {DIFFICULTY_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${
                  difficulty === value
                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-white/10 dark:text-indigo-400'
                    : 'text-slate-600 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {wasFlagged && (
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-600 dark:text-white/60">
            <input
              type="checkbox"
              checked={unflagOnSave}
              onChange={(e) => setUnflagOnSave(e.target.checked)}
              className="h-4 w-4 rounded border-indigo-300 accent-indigo-500"
            />
            Quitar la marca de revisión 🚩 al guardar
          </label>
        )}

        <p className="text-[12px] leading-relaxed text-slate-500 dark:text-white/35">
          Banco compartido: el cambio lo verán todos los usuarios. Tus respuestas anteriores a esta
          pregunta se conservan tal como se contestaron.
        </p>
      </div>

      <div className="border-t border-indigo-200/50 px-5 py-4 dark:border-white/[0.08]">
        {errorMsg && (
          <p className="mb-3 rounded-xl border border-rose-300/50 bg-rose-100/55 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
            {errorMsg}
          </p>
        )}
        {!errorMsg && dirty && (hasEmptyField || correctCount !== 1) && (
          <p className="mb-3 text-[12px] text-amber-600 dark:text-amber-300">
            {hasEmptyField
              ? 'La pregunta y las opciones no pueden quedar vacías.'
              : 'Marca exactamente una opción como correcta.'}
          </p>
        )}
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-indigo-300/50 px-5 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-indigo-50 disabled:opacity-40 dark:border-white/[0.1] dark:text-white/60 dark:hover:bg-white/[0.05]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </>
  );
}
