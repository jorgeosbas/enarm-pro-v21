'use client';

import { memo } from 'react';
import Link from 'next/link';

interface QuestionRowProps {
  question: {
    id: string;
    sequence_number: number | null;
    vignette: string;
    difficulty: string;
    theme?: { id: string; name: string } | null;
  };
  isDeleting: boolean;
  onDelete: (e: React.MouseEvent, questionId: string) => void;
}

/**
 * Fila individual del Banco de Preguntas.
 * Envuelta en React.memo: al escribir en el buscador o cambiar de filtro,
 * React solo vuelve a dibujar las filas cuyas props realmente cambiaron
 * (por ejemplo, la que está en proceso de borrado), no la lista completa.
 */
function QuestionRowComponent({ question, isDeleting, onDelete }: QuestionRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-indigo-300/50 bg-white/70 p-4 backdrop-blur-md transition-colors hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
      <Link href={`/estudiar/${question.id}`} className="flex-1 min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-100/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            #{question.sequence_number}
          </span>
          {question.theme && (
            <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {question.theme.name}
            </span>
          )}
          <span className={`text-[10px] font-medium ${
            question.difficulty === 'facil' ? 'text-emerald-600 dark:text-emerald-400'
            : question.difficulty === 'media' ? 'text-amber-600 dark:text-amber-400'
            : 'text-rose-600 dark:text-rose-400'
          }`}>
            {question.difficulty}
          </span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-700 dark:text-white/65">
          {question.vignette}
        </p>
      </Link>

      <button
        onClick={(e) => onDelete(e, question.id)}
        disabled={isDeleting}
        className="flex-shrink-0 rounded-xl border border-rose-300/50 bg-rose-100/55 p-2 text-rose-500 transition-colors hover:bg-rose-100/80 disabled:opacity-40 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-400"
        title="Eliminar pregunta"
      >
        {isDeleting ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export const QuestionRow = memo(QuestionRowComponent);
