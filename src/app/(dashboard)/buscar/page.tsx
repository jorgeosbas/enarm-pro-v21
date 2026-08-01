'use client';

import { useState, useMemo } from 'react';
import { useQuestions } from '@/features/question-bank/hooks/useQuestions';
import { Navigation } from '@/components/Navigation';
import Link from 'next/link';

export default function BuscarPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: allQuestions, isLoading, error } = useQuestions();

  // Búsqueda en tiempo real: filtra por vignette (texto de la pregunta)
  const results = useMemo(() => {
    if (!allQuestions || searchQuery.trim().length === 0) return [];

    const query = searchQuery.toLowerCase();
    return allQuestions.filter((q) =>
      q.vignette.toLowerCase().includes(query) ||
      q.explanation?.toLowerCase().includes(query)
    );
  }, [allQuestions, searchQuery]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Navigation />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold">🔍 Buscar preguntas</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Busca por palabras clave en preguntas y explicaciones.
          </p>
        </div>

        {/* Campo de búsqueda */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ej: diabetes, infarto, hipertensión..."
            className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            autoFocus
          />
        </div>

        {/* Estado de carga */}
        {isLoading && (
          <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-neutral-600 dark:text-neutral-400">Cargando preguntas...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900 dark:bg-danger-950">
            <p className="text-danger-700 dark:text-danger-400">
              Error al cargar preguntas. Intenta de nuevo.
            </p>
          </div>
        )}

        {/* Sin búsqueda aún */}
        {!isLoading && !error && searchQuery.trim().length === 0 && (
          <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-neutral-600 dark:text-neutral-400">
              Escribe algo para buscar preguntas...
            </p>
          </div>
        )}

        {/* Resultados */}
        {!isLoading && !error && searchQuery.trim().length > 0 && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold">
                {results.length} resultado(s) encontrado(s)
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-neutral-600 dark:text-neutral-400">
                  No encontramos preguntas que coincidan con "{searchQuery}".
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((question) => (
                  <Link
                    key={question.id}
                    href={`/estudiar/${question.id}`}
                    className="block rounded-lg border border-neutral-200 bg-white p-5 transition-all hover:border-primary-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-600"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className="rounded bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                        #{question.sequence_number}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        {question.theme?.name || 'General'}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          question.difficulty === 'facil'
                            ? 'text-green-600 dark:text-green-400'
                            : question.difficulty === 'media'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-danger-600 dark:text-danger-400'
                        }`}
                      >
                        {question.difficulty}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-neutral-700 dark:text-neutral-300">
                      {question.vignette}
                    </p>
                    <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {question.subcategory?.specialty?.name && (
                        <>
                          <span>{question.subcategory.specialty.name}</span>
                          {question.subcategory?.name && (
                            <span> → {question.subcategory.name}</span>
                          )}
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
