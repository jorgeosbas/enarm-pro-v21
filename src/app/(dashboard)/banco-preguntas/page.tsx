'use client';

import { useState } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useQuestions } from '@/features/question-bank/hooks/useQuestions';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { useSubcategoriesBySpecialty } from '@/features/question-bank/hooks/useSubcategories';
import { useThemesBySubcategory } from '@/features/question-bank/hooks/useThemesBySubcategory';
import { deleteQuestionAction } from '@/features/question-bank/actions/deleteQuestion';
import { Navigation } from '@/components/Navigation';

export default function BancoPreguntas() {
  const queryClient = useQueryClient();
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: specialties, isLoading: specialtiesLoading } = useSpecialties();
  const { data: subcategories, isLoading: subcatsLoading } = useSubcategoriesBySpecialty(selectedSpecialty || null);
  const { data: themes } = useThemesBySubcategory(selectedSubcategory || null);
  const { data: questions, isLoading: questionsLoading, error } = useQuestions(selectedSubcategory || null);

  async function handleDeleteQuestion(e: React.MouseEvent, questionId: string) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('¿Eliminar esta pregunta? No se puede deshacer.')) return;
    setDeletingId(questionId);
    try {
      const result = await deleteQuestionAction(questionId);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['questions', selectedSubcategory] });
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch {
      alert('Error al eliminar la pregunta.');
    } finally {
      setDeletingId(null);
    }
  }

  let displayQuestions = selectedSubcategory ? questions : null;
  if (displayQuestions && selectedTheme) {
    displayQuestions = selectedTheme === 'null'
      ? displayQuestions.filter((q) => !q.theme_id)
      : displayQuestions.filter((q) => q.theme_id === selectedTheme);
  }
  if (displayQuestions && searchQuery.trim()) {
    const term = searchQuery.toLowerCase();
    displayQuestions = displayQuestions.filter(
      (q2) => q2.vignette.toLowerCase().includes(term) || q2.explanation?.toLowerCase().includes(term)
    );
  }

  // Solución definitiva de tipado para currentSubcategory:
  const subcategoriesList = (subcategories as any[]) || [];
  const currentSubcategory: { id: string; name: string; [key: string]: any } | null = selectedSubcategory
    ? subcategoriesList.find((s) => s.id === selectedSubcategory) || null
    : null;

  const inp = 'w-full rounded-xl border border-indigo-300/50 bg-white/75 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';
  const lbl = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/35';

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />
      <div className="pointer-events-none fixed bottom-[20px] left-[160px] h-[220px] w-[220px] rounded-full bg-cyan-400/12 dark:bg-cyan-400/10" style={{ filter: 'blur(70px)' }} />

      <div className="relative z-10"><Navigation /></div>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-8 md:pb-10 lg:px-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-medium text-[#1e1b4b] dark:text-white">Banco de preguntas</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-white/40">
            Filtra por especialidad, subcategoría y tema para explorar tu banco.
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-5 rounded-xl border border-indigo-300/50 bg-white/70 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={lbl}>Especialidad</label>
              {specialtiesLoading ? (
                <div className="h-10 animate-pulse rounded-xl bg-indigo-100/50 dark:bg-white/[0.05]" />
              ) : (
                <CustomSelect value={selectedSpecialty} onChange={(e) => { setSelectedSpecialty(e.target.value); setSelectedSubcategory(''); setSelectedTheme(''); }}>
                  <option value="">Todas las especialidades</option>
                  {specialties?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </CustomSelect>
              )}
            </div>

            <div>
              <label className={lbl}>Subcategoría</label>
              {!selectedSpecialty ? (
                <div className="rounded-xl border border-indigo-200/50 bg-white/50 px-4 py-2.5 text-[13px] text-slate-400 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/20">
                  Elige especialidad primero
                </div>
              ) : subcatsLoading ? (
                <div className="h-10 animate-pulse rounded-xl bg-indigo-100/50 dark:bg-white/[0.05]" />
              ) : (
                <CustomSelect value={selectedSubcategory} onChange={(e) => { setSelectedSubcategory(e.target.value); setSelectedTheme(''); }}>
                  <option value="">Todas las subcategorías</option>
                  {subcategoriesList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </CustomSelect>
              )}
            </div>

            <div>
              <label className={lbl}>
                Tema
                <span className="ml-1.5 rounded-full border border-slate-300 bg-slate-200/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-600 dark:border-white/10 dark:bg-white/[0.04]">opcional</span>
              </label>
              {!selectedSubcategory ? (
                <div className="rounded-xl border border-indigo-200/50 bg-white/50 px-4 py-2.5 text-[13px] text-slate-400 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/20">
                  Elige subcategoría primero
                </div>
              ) : (
                <CustomSelect value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)}>
                  <option value="">Todos los temas</option>
                  <option value="null">General (sin tema)</option>
                  {themes?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </CustomSelect>
              )}
            </div>
          </div>

          {/* Búsqueda dentro de la subcategoría */}
          {selectedSubcategory && (
            <div className="mt-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en esta subcategoría..." className={`${inp} pl-9`} />
              </div>
            </div>
          )}
        </div>

        {/* Estado: sin subcategoría */}
        {!selectedSubcategory && (
          <div className="rounded-xl border border-indigo-300/50 bg-white/70 p-10 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="mb-3 text-3xl">📚</div>
            <p className="text-[14px] text-slate-600 dark:text-white/35">
              Selecciona una subcategoría para ver las preguntas.
            </p>
          </div>
        )}

        {/* Estado: cargando */}
        {selectedSubcategory && questionsLoading && (
          <div className="rounded-xl border border-indigo-300/50 bg-white/70 p-10 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="text-[13px] text-slate-500 dark:text-white/30">Cargando preguntas...</p>
          </div>
        )}

        {/* Estado: error */}
        {error && (
          <div className="rounded-xl border border-rose-300/50 bg-rose-100/55 p-5 backdrop-blur-md dark:border-rose-400/20 dark:bg-rose-500/[0.07]">
            <p className="text-[13px] text-rose-700 dark:text-rose-300">Error al cargar las preguntas. Intenta de nuevo.</p>
          </div>
        )}

        {/* Estado: sin preguntas */}
        {selectedSubcategory && !questionsLoading && displayQuestions && displayQuestions.length === 0 && (
          <div className="rounded-xl border border-indigo-300/50 bg-white/70 p-10 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="mb-3 text-3xl">📭</div>
            <p className="mb-4 text-[14px] text-slate-600 dark:text-white/35">
              No hay preguntas en "{currentSubcategory?.name}".
            </p>
            <Link href="/importar" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90">
              Importar preguntas →
            </Link>
          </div>
        )}

        {/* Lista de preguntas */}
        {displayQuestions && displayQuestions.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/70">
                {displayQuestions.length} pregunta{displayQuestions.length !== 1 ? 's' : ''} en "{currentSubcategory?.name}"
              </p>
              <Link href="/importar" className="text-[12px] text-indigo-500 dark:text-indigo-400 hover:underline">
                + Importar más
              </Link>
            </div>

            <div className="space-y-2 animate-slide-up">
              {displayQuestions.map((question: any) => (
                <div key={question.id} className="flex items-center gap-3 rounded-xl border border-indigo-300/50 bg-white/70 p-4 backdrop-blur-md transition-colors hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
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
                    onClick={(e) => handleDeleteQuestion(e, question.id)}
                    disabled={deletingId === question.id}
                    className="flex-shrink-0 rounded-xl border border-rose-300/50 bg-rose-100/55 p-2 text-rose-500 transition-colors hover:bg-rose-100/80 disabled:opacity-40 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-400"
                    title="Eliminar pregunta"
                  >
                    {deletingId === question.id ? (
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
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
