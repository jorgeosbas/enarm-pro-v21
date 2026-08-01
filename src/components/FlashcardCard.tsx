'use client';

import { useState, useEffect } from 'react';
import { FlashcardWithProgress, FlashcardRating } from '@/features/flashcards/types';

interface FlashcardCardProps {
  flashcard: FlashcardWithProgress;
  onRate: (rating: FlashcardRating) => void;
  isLoading?: boolean;
  currentIndex?: number;
  totalCards?: number;
}

export function FlashcardCard({
  flashcard,
  onRate,
  isLoading = false,
  currentIndex = 0,
  totalCards = 0,
}: FlashcardCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [answerAnim, setAnswerAnim] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    setIsFlipped(false);
  }, [flashcard.id, currentIndex]);

  function handleRateClick(rating: FlashcardRating) {
    // Disparar animación visual según la calificación
    const anim = rating === 'again' ? 'wrong' : rating === 'easy' ? 'correct' : null;
    if (anim) {
      setAnswerAnim(anim);
      setTimeout(() => setAnswerAnim(null), 450);
    }
    setTimeout(() => {
      setIsFlipped(false);
      onRate(rating);
    }, anim ? 180 : 0);
  }

  const correctOption = flashcard.options.find((opt) => opt.is_correct);

  const ratingButtons = [
    { rating: 'again' as FlashcardRating, label: 'Repetir', emoji: '❌',
      cls: 'border-rose-300/50 bg-rose-100/55 text-rose-700 hover:bg-rose-100/80 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300' },
    { rating: 'hard' as FlashcardRating, label: 'Difícil', emoji: '😕',
      cls: 'border-amber-300/50 bg-amber-100/55 text-amber-700 hover:bg-amber-100/80 dark:border-amber-400/20 dark:bg-amber-500/[0.07] dark:text-amber-300' },
    { rating: 'good' as FlashcardRating, label: 'Bien', emoji: '😊',
      cls: 'border-indigo-300/50 bg-indigo-100/55 text-indigo-700 hover:bg-indigo-100/80 dark:border-indigo-400/20 dark:bg-indigo-500/[0.07] dark:text-indigo-300' },
    { rating: 'easy' as FlashcardRating, label: 'Fácil', emoji: '🎉',
      cls: 'border-emerald-300/50 bg-emerald-100/55 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300' },
  ];

  return (
    <div className={`mx-auto max-w-2xl ${answerAnim === 'wrong' ? 'animate-shake' : answerAnim === 'correct' ? 'animate-bounce-in' : ''}`}>
      {/* Mini stats */}
      <div className="mb-4 flex items-center justify-between text-[12px] text-slate-500 dark:text-white/30">
        <span>Tarjeta {currentIndex + 1} de {totalCards}</span>
        <div className="flex gap-3">
          <span>Estabilidad: {flashcard.progress.stability.toFixed(1)}</span>
          <span>Dificultad: {flashcard.progress.difficulty.toFixed(1)}/10</span>
        </div>
      </div>

      {/* Tarjeta con giro */}
      <div className="relative mb-6 min-h-[320px] cursor-pointer">
        {/* Cara frontal — pregunta */}
        <div
          onClick={() => setIsFlipped(true)}
          className={`absolute inset-0 rounded-2xl border p-8 backdrop-blur-md transition-all duration-500 ${
            isFlipped
              ? 'scale-95 opacity-0 pointer-events-none z-0 border-indigo-300/50 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04]'
              : 'scale-100 opacity-100 pointer-events-auto z-10 border-indigo-300/50 bg-white/75 dark:border-indigo-400/20 dark:bg-indigo-500/[0.06]'
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100/80 text-2xl dark:bg-indigo-500/15">
              ❓
            </div>
            <p className="mb-6 text-[16px] font-medium leading-relaxed text-[#1e1b4b] dark:text-white/90">
              {flashcard.vignette}
            </p>
            <p className="text-[12px] text-slate-500 dark:text-white/30">
              Toca para ver la respuesta
            </p>
          </div>
        </div>

        {/* Cara trasera — respuesta */}
        <div
          onClick={() => setIsFlipped(false)}
          className={`absolute inset-0 rounded-2xl border p-8 backdrop-blur-md transition-all duration-500 ${
            isFlipped
              ? 'scale-100 opacity-100 pointer-events-auto z-10 border-emerald-300/50 bg-emerald-100/55 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07]'
              : 'scale-95 opacity-0 pointer-events-none z-0 border-emerald-300/50 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04]'
          }`}
        >
          <div className="flex h-full flex-col justify-center">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Respuesta correcta
            </p>
            <p className="mb-5 text-[16px] font-medium leading-relaxed text-emerald-900 dark:text-emerald-100">
              {correctOption?.content}
            </p>

            {flashcard.explanation && (
              <>
                <div className="mb-4 border-t border-emerald-300/60 dark:border-emerald-400/15" />
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Explicación
                </p>
                <p className="text-[13px] leading-relaxed text-emerald-800 dark:text-emerald-200/80">
                  {flashcard.explanation}
                </p>
              </>
            )}

            <p className="mt-4 text-[11px] text-emerald-700/70 dark:text-emerald-400/40">
              Toca para volver a la pregunta
            </p>
          </div>
        </div>
      </div>

      {/* Botones de calificación */}
      {isFlipped && (
        <div>
          <p className="mb-3 text-center text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">
            ¿Qué tan bien la recordabas?
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ratingButtons.map(({ rating, label, emoji, cls }) => (
              <button
                key={rating}
                onClick={() => handleRateClick(rating)}
                disabled={isLoading}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[12px] font-medium backdrop-blur-md transition-all disabled:opacity-40 ${cls}`}
              >
                <span className="text-lg">{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
