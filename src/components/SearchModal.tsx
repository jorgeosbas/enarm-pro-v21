'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuestions } from '@/features/question-bank/hooks/useQuestions';
import { SearchResultRow } from '@/components/SearchResultRow';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: allQuestions, isLoading } = useQuestions();

  // Asegurar renderizado solo en cliente — evita errores de hidratación
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    return undefined;
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    if (searchQuery.trim().length === 0) return [];
    const term = searchQuery.toLowerCase();
    return (allQuestions || []).filter(
      (q) =>
        q.vignette.toLowerCase().includes(term) ||
        q.explanation?.toLowerCase().includes(term)
    );
  }, [allQuestions, searchQuery]);

  const handleSelectQuestion = useCallback((questionId: string) => {
    router.push(`/estudiar/${questionId}`);
    onClose();
  }, [router, onClose]);

  // Solo renderiza en cliente y cuando está abierto
  if (!isOpen || !mounted) return null;

  const modal = (
    <>
      {/* Backdrop — z extremadamente alto */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />

      {/* Panel del modal */}
      <div className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-20 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-indigo-300/50 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0f0f1a]/95 animate-slide-down"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input de búsqueda */}
          <div className="flex items-center gap-3 border-b border-indigo-200/60 px-5 py-4 dark:border-white/[0.07]">
            <svg
              className="h-4 w-4 flex-shrink-0 text-indigo-400 dark:text-indigo-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busca por palabras clave (diabetes, cardio, infarto...)"
              className="flex-1 bg-transparent text-[14px] text-[#1e1b4b] outline-none placeholder:text-slate-500 dark:text-white/85 dark:placeholder:text-white/25"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="rounded-lg p-1 text-slate-500 transition-colors hover:text-slate-700 dark:text-white/30 dark:hover:text-white/60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Resultados */}
          <div className="max-h-[420px] overflow-y-auto">
            {/* Estado vacío inicial */}
            {searchQuery.trim().length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100/70 dark:bg-indigo-500/10">
                  <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <p className="text-[13px] text-slate-500 dark:text-white/30">
                  Escribe para buscar en tu banco de preguntas
                </p>
              </div>
            )}

            {/* Cargando */}
            {isLoading && searchQuery && (
              <div className="py-10 text-center text-[13px] text-slate-500 dark:text-white/30">
                Buscando...
              </div>
            )}

            {/* Sin resultados */}
            {!isLoading && searchQuery.trim().length > 0 && results.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-[13px] text-slate-500 dark:text-white/30">
                  Sin resultados para <span className="font-medium text-slate-700 dark:text-white/50">"{searchQuery}"</span>
                </p>
              </div>
            )}

            {/* Lista de resultados */}
            {results.length > 0 && (
              <div className="space-y-1 p-3">
                {results.map((question) => (
                  <SearchResultRow
                    key={question.id}
                    question={question}
                    onSelect={handleSelectQuestion}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-indigo-200/60 bg-white/60 px-5 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500 dark:text-white/25">
                {results.length > 0 ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : 'ENARM Pro'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-white/25">
                Presiona{' '}
                <kbd className="rounded border border-indigo-300/50 bg-indigo-100/70 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/30">
                  Esc
                </kbd>{' '}
                para cerrar
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}