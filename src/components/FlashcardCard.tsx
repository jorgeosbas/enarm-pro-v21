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

  // Tarjetas blancas de vidrio con acento de color fuerte (ícono + borde lateral),
  // en vez de teñir toda la superficie — así el contraste se mantiene alto.
  const ratingButtons = [
    {
      rating: 'again' as FlashcardRating, label: 'Repetir', emoji: '❌',
      iconBg: 'bg-rose-500/70', textColor: 'text-rose-700 dark:text-rose-300',
      cls: 'border-indigo-300/50 bg-white/85 hover:border-rose-300 hover:bg-rose-50/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-rose-500/[0.07]',
    },
    {
      rating: 'hard' as FlashcardRating, label: 'Difícil', emoji: '😕',
      iconBg: 'bg-amber-500/70', textColor: 'text-amber-700 dark:text-amber-300',
      cls: 'border-indigo-300/50 bg-white/85 hover:border-amber-300 hover:bg-amber-50/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-amber-500/[0.07]',
    },
    {
      rating: 'good' as FlashcardRating, label: 'Bien', emoji: '😊',
      iconBg: 'bg-indigo-500/70', textColor: 'text-indigo-700 dark:text-indigo-300',
      cls: 'border-indigo-300/50 bg-white/85 hover:border-indigo-300 hover:bg-indigo-50/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-indigo-500/[0.07]',
    },
    {
      rating: 'easy' as FlashcardRating, label: 'Fácil', emoji: '🎉',
      iconBg: 'bg-emerald-500/70', textColor: 'text-emerald-700 dark:text-emerald-300',
      cls: 'border-indigo-300/50 bg-white/85 hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-emerald-500/[0.07]',
    },
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
              : 'scale-100 opacity-100 pointer-events-auto z-10 border-indigo-300/60 bg-white/85 dark:border-indigo-400/20 dark:bg-indigo-500/[0.06]'
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/55 text-2xl shadow-sm shadow-indigo-500/10">
              <span className="text-white">❓</span>
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
          className={`absolute inset-0 overflow-hidden rounded-2xl border p-8 backdrop-blur-md transition-all duration-500 ${
            isFlipped
              ? 'scale-100 opacity-100 pointer-events-auto z-10 border-slate-200/70 bg-white/90 dark:border-white/[0.08] dark:bg-white/[0.04]'
              : 'scale-95 opacity-0 pointer-events-none z-0 border-indigo-300/50 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.04]'
          }`}
        >
          {/* Franja lateral de acento — identifica "correcto" sin teñir toda la tarjeta */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500/75" />

          <div className="flex h-full flex-col justify-center pl-2">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/70 text-[11px] text-white">✓</span>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Respuesta correcta
              </p>
            </div>
            <p className="mb-5 text-[16px] font-medium leading-relaxed text-[#1e1b4b] dark:text-emerald-100">
              {correctOption?.content}
            </p>

            {flashcard.explanation && (
              <>
                <div className="mb-4 border-t border-slate-200/80 dark:border-emerald-400/15" />
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-emerald-400">
                  Explicación
                </p>
                <p className="text-[13px] leading-relaxed text-slate-700 dark:text-emerald-200/80">
                  {flashcard.explanation}
                </p>
              </>
            )}

            <p className="mt-4 text-[11px] text-slate-500 dark:text-emerald-400/40">
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
            {ratingButtons.map(({ rating, label, emoji, iconBg, textColor, cls }) => (
              <button
                key={rating}
                onClick={() => handleRateClick(rating)}
                disabled={isLoading}
                className={`flex flex-col items-center gap-2 rounded-xl border py-4 text-[12px] font-medium transition-all disabled:opacity-40 ${cls}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base shadow-sm ${iconBg}`}>
                  {emoji}
                </span>
                <span className={textColor}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
