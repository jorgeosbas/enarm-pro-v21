'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTrainingQuestions } from '@/features/training/hooks/useTrainingQuestions';
import { recordAnswerAction } from '@/features/question-bank/actions/recordAnswer';
import { Navigation } from '@/components/Navigation';
import { shuffleArray } from '@/lib/utils/shuffle';

export default function EntrenamientoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const countParam = searchParams.get('count');
  const requestedCount = countParam ? parseInt(countParam, 10) : 10;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [answerAnim, setAnswerAnim] = useState<'correct' | 'wrong' | null>(null);

  const { data: questions, isLoading, error } = useTrainingQuestions(requestedCount);

  // Garantizar que TypeScript no marque 'undefined' al acceder a currentQuestion
  const currentQuestion = (questions?.[currentIndex] || questions?.[0]) as any;

  // Aleatoriza el orden de las opciones — se recalcula solo cuando cambia la pregunta.
  // La corrección siempre compara por option.id / option.is_correct, nunca por posición.
  const shuffledOptions = useMemo(
    () => shuffleArray(currentQuestion?.options ?? []),
    [currentQuestion?.id]
  );

  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
        <Navigation />
        <div className="flex flex-1 items-center justify-center pt-32">
          <div className="text-center">
            <p className="mb-2 text-[15px] font-medium text-[#1e1b4b] dark:text-white">
              Analizando tu historial...
            </p>
            <p className="text-[13px] text-slate-500 dark:text-white/40">
              Seleccionando las preguntas con mayor prioridad para ti
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !questions || questions.length === 0) {
    return (
      <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
        <Navigation />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-32">
          <p className="mb-4 text-[14px] text-rose-600 dark:text-rose-400">
            No hay preguntas disponibles para el entrenamiento.
          </p>
          <button onClick={() => router.push('/dashboard')} className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-[13px] font-medium text-white">
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  const selectedOption = currentQuestion?.options?.find((opt: any) => opt.id === selectedOptionId);
  const isCorrect = selectedOption?.is_correct ?? false;
  const progress = currentIndex + 1;
  const total = questions.length;

  async function handleAnswerSubmit() {
    if (!selectedOptionId || !currentQuestion) return;
    setSaving(true);
    try {
      await recordAnswerAction(currentQuestion.id, selectedOptionId, isCorrect);
      if (isCorrect) {
        setCorrectCount((prev) => prev + 1);
        setAnswerAnim('correct');
      } else {
        setAnswerAnim('wrong');
      }
      setTimeout(() => setAnswerAnim(null), 450);
      setHasAnswered(true);
    } catch (err) {
      console.error('Error guardando respuesta:', err);
      alert('Hubo un error al guardar tu respuesta.');
    } finally {
      setSaving(false);
    }
  }

  function handleNextQuestion() {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOptionId(null);
      setHasAnswered(false);
    } else {
      router.push(
        `/resultado-simulador?correct=${correctCount}&total=${total}&theme=Entrenamiento Inteligente`
      );
    }
  }

  // Etiqueta de importancia ENARM
  function importanceLabel(val: number) {
    const labels: Record<number, string> = {
      1: 'Poco frecuente',
      2: 'Baja frecuencia',
      3: 'Frecuencia media',
      4: 'Muy frecuente',
      5: 'Alta prioridad ENARM',
    };
    return labels[val] ?? 'Media';
  }

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      {/* Blobs de fondo */}
      <div
        className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18"
        style={{ filter: 'blur(90px)' }}
      />
      <div
        className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14"
        style={{ filter: 'blur(80px)' }}
      />

      <div className="relative z-10">
        <Navigation />
      </div>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-24 pt-8 md:pb-10 lg:px-6">
        {/* Barra de progreso */}
        <div className="mb-7">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/80">
              Pregunta {progress} de {total}
            </span>
            <span className="text-[13px] text-slate-500 dark:text-white/40">
              Aciertos: {correctCount}/{progress - 1 > 0 ? progress - 1 : 0}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100/70 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all"
              style={{ width: `${(progress / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Chips de categoría + importancia */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {currentQuestion?.subcategory?.specialty?.name && (
            <span className="rounded-full border border-indigo-300/50 bg-indigo-100/60 px-3 py-1 text-[12px] text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/15 dark:text-indigo-300">
              {currentQuestion.subcategory.specialty.name}
            </span>
          )}
          {currentQuestion?.subcategory?.name && (
            <span className="rounded-full border border-indigo-300/50 bg-white/70 px-3 py-1 text-[12px] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
              {currentQuestion.subcategory.name}
            </span>
          )}
          {currentQuestion?.theme?.name && (
            <span className="rounded-full border border-amber-300/50 bg-amber-100/60 px-3 py-1 text-[12px] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
              {currentQuestion.theme.name}
            </span>
          )}
          {/* Importancia ENARM */}
          <span
            className={`ml-auto rounded-full px-3 py-1 text-[11px] font-medium ${
              (currentQuestion?.importance ?? 0) >= 4
                ? 'border border-rose-300/50 bg-rose-100/60 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300'
                : currentQuestion?.importance === 3
                  ? 'border border-slate-300/50 bg-white/70 text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/40'
                  : 'border border-emerald-300/50 bg-emerald-100/60 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300'
            }`}
          >
            ★ {importanceLabel(currentQuestion?.importance ?? 3)}
          </span>
        </div>

        {/* Viñeta */}
        <div className="mb-6 rounded-2xl border border-indigo-300/50 bg-white/70 p-6 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
          <p className="text-[15px] leading-relaxed text-[#1e1b4b] dark:text-white/90">
            {currentQuestion?.vignette}
          </p>
        </div>

        {/* Opciones */}
        <div className={`mb-6 space-y-3 ${answerAnim === 'wrong' ? 'animate-shake' : answerAnim === 'correct' ? 'animate-bounce-in' : ''}`}>
          {shuffledOptions.map((option: any, idx: number) => {
            const selected = selectedOptionId === option.id;
            const showCorrect = hasAnswered && option.is_correct;
            const showWrong = hasAnswered && selected && !option.is_correct;
            const displayLabel = String.fromCharCode(65 + idx);

            return (
              <button
                key={option.id}
                onClick={() => !hasAnswered && setSelectedOptionId(option.id)}
                disabled={hasAnswered}
                className={`w-full rounded-xl border px-5 py-4 text-left transition-all backdrop-blur-md ${
                  !hasAnswered ? 'cursor-pointer' : 'cursor-default'
                } ${
                  showCorrect
                    ? 'border-emerald-400/50 bg-emerald-50/70 dark:border-emerald-400/30 dark:bg-emerald-500/10'
                    : showWrong
                      ? 'border-rose-400/50 bg-rose-50/70 dark:border-rose-400/30 dark:bg-rose-500/10'
                      : selected && !hasAnswered
                        ? 'border-indigo-400/50 bg-indigo-50/70 dark:border-indigo-400/30 dark:bg-indigo-500/10'
                        : 'border-indigo-300/50 bg-white/70 hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                      showCorrect
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : showWrong
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : selected && !hasAnswered
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-indigo-300 dark:border-white/20'
                    }`}
                  >
                    {showCorrect ? '✓' : showWrong ? '✗' : selected && !hasAnswered ? '✓' : ''}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/80">
                      {displayLabel})
                    </p>
                    <p className="mt-1 text-[14px] text-slate-700 dark:text-white/70">
                      {option.content}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explicación */}
        {hasAnswered && currentQuestion?.explanation && (
          <div className="mb-5 rounded-xl border border-indigo-300/45 bg-indigo-100/55 p-5 backdrop-blur-md dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
            <p className="mb-1 text-[12px] font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Explicación
            </p>
            <p className="text-[14px] leading-relaxed text-slate-700 dark:text-white/70">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Resultado */}
        {hasAnswered && (
          <div
            className={`mb-6 rounded-xl border p-4 backdrop-blur-md animate-slide-up ${
              isCorrect
                ? 'border-emerald-300/50 bg-emerald-100/55 dark:border-emerald-400/20 dark:bg-emerald-500/10'
                : 'border-rose-300/50 bg-rose-100/55 dark:border-rose-400/20 dark:bg-rose-500/10'
            }`}
          >
            <p
              className={`text-[15px] font-medium ${
                isCorrect
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          {!hasAnswered ? (
            <button
              onClick={handleAnswerSubmit}
              disabled={!selectedOptionId || saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Guardando...' : 'Confirmar respuesta'}
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {currentIndex < total - 1 ? 'Siguiente pregunta →' : 'Ver resultados →'}
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-xl border border-indigo-300/50 bg-white/65 px-5 py-3 text-[14px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50 dark:hover:bg-white/[0.07]"
          >
            Salir
          </button>
        </div>
      </main>
    </div>
  );
}
