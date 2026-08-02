'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { recordAnswerAction } from '@/features/question-bank/actions/recordAnswer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { shuffleArray } from '@/lib/utils/shuffle';

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
  const [answerAnim, setAnswerAnim] = useState<'correct' | 'wrong' | null>(null);

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

  // Aleatoriza el orden de las opciones — se recalcula solo cuando cambia la pregunta.
  // La corrección siempre compara por option.id / option.is_correct, nunca por posición.
  const shuffledOptions = useMemo(
    () => shuffleArray(question?.options ?? []),
    [question?.id]
  );

  if (isLoading) return <LoadingScreen message="Cargando pregunta..." />;

  if (error || !question) {
    return (
      <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
        <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
        
        <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-32 gap-4">
          <p className="text-[13px] text-rose-500 dark:text-rose-400">Error al cargar la pregunta.</p>
          <button onClick={() => router.back()} className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-[13px] text-white">
            Volver
          </button>
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
      setAnswerAnim(isCorrect ? 'correct' : 'wrong');
      setTimeout(() => setAnswerAnim(null), 450);
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
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10 lg:px-6">
        {/* Botón de volver */}
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-[13px] text-slate-600 transition-colors hover:text-slate-900 dark:text-white/40 dark:hover:text-white/80"
        >
          ← Volver
        </button>

        {/* Breadcrumb con especialidad y subcategoría */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {specialty && (
            <>
              <span className="rounded-full border border-indigo-300/50 bg-indigo-100/60 px-3 py-1 text-[12px] text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/15 dark:text-indigo-300">
                {specialty.name}
              </span>
              <span className="text-slate-400 dark:text-white/20">→</span>
            </>
          )}
          {subcategory && (
            <span className="rounded-full border border-indigo-300/50 bg-white/70 px-3 py-1 text-[12px] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
              {subcategory.name}
            </span>
          )}
          <span
            className={`ml-auto text-[11px] font-semibold ${
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

        {/* Viñeta */}
        <div className="mb-5 rounded-2xl border border-indigo-300/50 bg-white/70 p-6 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
          <p className="text-[15px] leading-relaxed text-[#1e1b4b] dark:text-white/90">
            {question.vignette}
          </p>
        </div>

        {/* Opciones */}
        <div className={`mb-5 space-y-2.5 ${answerAnim === 'wrong' ? 'animate-shake' : answerAnim === 'correct' ? 'animate-bounce-in' : ''}`}>
          {shuffledOptions.map((option, idx) => {
            const selected = selectedOptionId === option.id;
            const showAsCorrect = hasAnswered && option.is_correct;
            const showAsIncorrect = hasAnswered && selected && !option.is_correct;
            const displayLabel = String.fromCharCode(65 + idx);

            return (
              <button
                key={option.id}
                onClick={() => !hasAnswered && setSelectedOptionId(option.id)}
                disabled={hasAnswered}
                className={`w-full rounded-xl border px-5 py-4 text-left backdrop-blur-md transition-all ${
                  showAsCorrect
                    ? 'border-emerald-400/50 bg-emerald-50/70 dark:border-emerald-400/30 dark:bg-emerald-500/10'
                    : showAsIncorrect
                      ? 'border-rose-400/50 bg-rose-50/70 dark:border-rose-400/30 dark:bg-rose-500/10'
                      : selected && !hasAnswered
                        ? 'border-indigo-400/50 bg-indigo-50/70 dark:border-indigo-400/30 dark:bg-indigo-500/10'
                        : 'border-indigo-300/50 bg-white/70 hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'
                } ${hasAnswered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                      showAsCorrect
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : showAsIncorrect
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : selected && !hasAnswered
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-indigo-300 dark:border-white/20'
                    }`}
                  >
                    {(showAsCorrect || (selected && !hasAnswered)) && '✓'}
                    {showAsIncorrect && '✗'}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/80">{displayLabel})</p>
                    <p className="mt-1 text-[14px] text-slate-700 dark:text-white/65">{option.content}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explicación (si ya respondió) */}
        {hasAnswered && question.explanation && (
          <div className="mb-4 rounded-xl border border-indigo-300/45 bg-indigo-100/55 p-5 backdrop-blur-md dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
            <p className="mb-1 text-[12px] font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Explicación</p>
            <p className="text-[14px] leading-relaxed text-slate-700 dark:text-white/70">{question.explanation}</p>
          </div>
        )}

        {/* Resultado (si ya respondió) */}
        {hasAnswered && (
          <div className={`mb-5 rounded-xl border p-4 backdrop-blur-md animate-slide-up ${isCorrect ? 'border-emerald-300/50 bg-emerald-100/55 dark:border-emerald-400/20 dark:bg-emerald-500/10' : 'border-rose-300/50 bg-rose-100/55 dark:border-rose-400/20 dark:bg-rose-500/10'}`}>
            <p className={`text-[15px] font-medium ${isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3">
          {!hasAnswered ? (
            <button onClick={handleAnswerSubmit} disabled={!selectedOptionId || saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
              {saving ? 'Guardando…' : 'Confirmar respuesta'}
            </button>
          ) : (
            <button onClick={handleNextQuestion}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90">
              Volver al banco →
            </button>
          )}
          <button onClick={() => router.push('/banco-preguntas')}
            className="rounded-xl border border-indigo-300/50 bg-white/65 px-5 py-3 text-[14px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
            Banco
          </button>
        </div>
      </main>
    </div>
  );
}