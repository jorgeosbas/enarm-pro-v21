'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { recordAnswerAction } from '@/features/question-bank/actions/recordAnswer';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';

interface QuestionDetail {
  id: string;
  subcategory_id: string;
  difficulty: string;
  vignette: string;
  explanation: string | null;
  options: Array<{
    id: string;
    label: string;
    content: string;
    is_correct: boolean;
  }>;
  subcategory?: {
    id: string;
    name: string;
    specialty?: {
      id: string;
      name: string;
      code: string;
    };
  };
}

export default function EstudiarPregunta({ params }: { params: any }) {
  const router = useRouter();
  const questionId = params?.id;

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [saving, setSaving] = useState(false);

  // Traer la pregunta específica
  const { data: question, isLoading, error } = useQuery({
    queryKey: ['question', questionId],
    queryFn: async () => {
      const supabase = createClient();

      const { data: q, error: qError } = await supabase
        .from('questions')
        .select(
          `
          id,
          subcategory_id,
          difficulty,
          vignette,
          explanation,
          subcategory:subcategories(
            id,
            name,
            specialty:specialties(id, name, code)
          )
        `
        )
        .eq('id', questionId)
        .single();

      if (qError || !q) throw qError || new Error('Pregunta no encontrada');

      const { data: opts, error: optsError } = await supabase
        .from('question_options')
        .select('id, label, content, is_correct')
        .eq('question_id', questionId)
        .order('label');

      if (optsError) throw optsError;

      return {
        ...(q as Record<string, any>),
        options: opts || [],
      } as unknown as QuestionDetail;
    },
    enabled: Boolean(questionId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
        <Navigation />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-neutral-600 dark:text-neutral-400">Cargando pregunta...</p>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
        <Navigation />
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="mb-4 text-rose-700 dark:text-rose-400">Error al cargar la pregunta.</p>
          <Button onClick={() => router.back()}>Volver</Button>
        </div>
      </div>
    );
  }

  const selectedOption = question.options?.find((opt) => opt.id === selectedOptionId);
  const isCorrect = selectedOption?.is_correct ?? false;
  const specialty = question.subcategory?.specialty;
  const subcategory = question.subcategory;

  async function handleAnswerSubmit() {
    if (!selectedOptionId || !questionId) return;

    setSaving(true);
    try {
      await recordAnswerAction(questionId, selectedOptionId, isCorrect);
      setHasAnswered(true);
    } catch (err) {
      console.error('Error saving answer:', err);
      alert('Hubo un error al guardar tu respuesta. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function handleNextQuestion() {
    router.push('/banco-preguntas');
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Navigation />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Botón de volver */}
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← Volver
        </button>

        {/* Breadcrumb con especialidad y subcategoría */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          {specialty && (
            <>
              <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                {specialty.name}
              </span>
              <span className="text-neutral-400">→</span>
            </>
          )}
          {subcategory && (
            <span className="rounded-full bg-indigo-200 px-3 py-1 font-medium text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200">
              {subcategory.name}
            </span>
          )}
          <span
            className={`ml-auto text-xs font-semibold ${
              question.difficulty === 'facil'
                ? 'text-emerald-600 dark:text-emerald-400'
                : question.difficulty === 'media'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {question.difficulty}
          </span>
        </div>

        {/* Vignette */}
        <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-lg leading-relaxed text-neutral-800 dark:text-neutral-200">
            {question.vignette}
          </p>
        </div>

        {/* Opciones */}
        <div className="mb-8 space-y-3">
          {question.options?.map((option) => {
            const selected = selectedOptionId === option.id;
            const showAsCorrect = hasAnswered && option.is_correct;
            const showAsIncorrect = hasAnswered && selected && !option.is_correct;

            return (
              <button
                key={option.id}
                onClick={() => !hasAnswered && setSelectedOptionId(option.id)}
                disabled={hasAnswered}
                className={`w-full rounded-lg border-2 px-5 py-4 text-left transition-all ${
                  !hasAnswered
                    ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600'
                    : 'cursor-default'
                } ${
                  selected && !hasAnswered
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950'
                    : 'border-neutral-200 dark:border-neutral-800'
                } ${
                  showAsCorrect
                    ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950'
                    : ''
                } ${
                  showAsIncorrect
                    ? 'border-rose-500 bg-rose-50 dark:border-rose-600 dark:bg-rose-950'
                    : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      showAsCorrect
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : showAsIncorrect
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : selected && !hasAnswered
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {selected && !hasAnswered && '✓'}
                    {showAsCorrect && '✓'}
                    {showAsIncorrect && '✗'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {option.label})
                    </div>
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                      {option.content}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explicación (si ya respondió) */}
        {hasAnswered && question.explanation && (
          <div className="mb-8 rounded-lg border border-indigo-300 bg-indigo-100 p-6 dark:border-indigo-800 dark:bg-indigo-900">
            <h3 className="mb-2 font-semibold text-indigo-950 dark:text-indigo-100">
              Explicación
            </h3>
            <p className="text-sm leading-relaxed text-indigo-900 dark:text-indigo-100">
              {question.explanation}
            </p>
          </div>
        )}

        {/* Resultado (si ya respondió) */}
        {hasAnswered && (
          <div
            className={`mb-8 rounded-lg border p-6 ${
              isCorrect
                ? 'border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950'
                : 'border-rose-300 bg-rose-100 dark:border-rose-800 dark:bg-rose-950'
            }`}
          >
            <p
              className={`text-lg font-semibold ${
                isCorrect
                  ? 'text-emerald-900 dark:text-emerald-200'
                  : 'text-rose-900 dark:text-rose-200'
              }`}
            >
              {isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-4">
          {!hasAnswered ? (
            <Button
              onClick={handleAnswerSubmit}
              disabled={!selectedOptionId || saving}
              className="flex-1"
            >
              {saving ? 'Guardando…' : 'Confirmar respuesta'}
            </Button>
          ) : (
            <Button onClick={handleNextQuestion} className="flex-1">
              Volver al banco →
            </Button>
          )}
          <Button variant="secondary" onClick={() => router.push('/banco-preguntas')}>
            Banco
          </Button>
        </div>
      </main>
    </div>
  );
}