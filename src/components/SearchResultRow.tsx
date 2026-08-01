'use client';

import { memo } from 'react';

interface SearchResultRowProps {
  question: {
    id: string;
    sequence_number: number | null;
    vignette: string;
    difficulty: string;
    theme?: { id: string; name: string } | null;
    subcategory?: { name: string; specialty?: { name: string } | null } | null;
  };
  onSelect: (questionId: string) => void;
}

/**
 * Fila individual de resultado en el buscador ⌘K.
 * React.memo evita volver a dibujar todas las filas cuando solo cambia
 * el texto que se está escribiendo (los resultados nuevos sí se dibujan).
 */
function SearchResultRowComponent({ question, onSelect }: SearchResultRowProps) {
  return (
    <button
      onClick={() => onSelect(question.id)}
      className="w-full rounded-xl border border-transparent px-4 py-3 text-left transition-all hover:border-indigo-300/60 hover:bg-indigo-100/60 dark:hover:border-indigo-400/20 dark:hover:bg-indigo-500/[0.08]"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-indigo-100/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          #{question.sequence_number}
        </span>
        {question.theme && (
          <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {question.theme.name}
          </span>
        )}
        <span className={`text-[10px] font-medium ${
          question.difficulty === 'facil'
            ? 'text-emerald-500'
            : question.difficulty === 'media'
              ? 'text-amber-500'
              : 'text-rose-500'
        }`}>
          {question.difficulty}
        </span>
      </div>

      <p className="mb-1 line-clamp-2 text-[13px] leading-relaxed text-slate-700 dark:text-white/70">
        {question.vignette}
      </p>

      {question.subcategory?.specialty?.name && (
        <p className="text-[11px] text-slate-500 dark:text-white/25">
          {question.subcategory.specialty.name}
          {question.subcategory?.name && ` → ${question.subcategory.name}`}
        </p>
      )}
    </button>
  );
}

export const SearchResultRow = memo(SearchResultRowComponent);
