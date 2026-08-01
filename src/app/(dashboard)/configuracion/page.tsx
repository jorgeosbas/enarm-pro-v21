'use client';

import { useState } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useQueryClient } from '@tanstack/react-query';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { useSubcategoriesBySpecialty } from '@/features/question-bank/hooks/useSubcategories';
import { useThemesBySubcategory } from '@/features/question-bank/hooks/useThemesBySubcategory';
import { deleteSubcategoryAction, deleteThemeAction } from '@/features/question-bank/actions/deleteSubcategoryAndTheme';
import { resetPriorityScoreAction } from '@/features/training/actions/resetPriorityScore';
import { resetAllFlashcardsProgressAction } from '@/features/flashcards/actions/updateProgress';
import { Navigation } from '@/components/Navigation';

export default function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'subcategory' | 'theme' | null>(null);
  const [isResettingFlashcards, setIsResettingFlashcards] = useState(false);
  const [isResettingScore, setIsResettingScore] = useState(false);

  const { data: specialties } = useSpecialties();
  const { data: subcategories } = useSubcategoriesBySpecialty(selectedSpecialty || null);
  const { data: themes } = useThemesBySubcategory(selectedSubcategory || null);

  // Solución de tipado para subcategorías y temas
  const subcategoriesList = (subcategories as any[]) || [];
  const themesList = (themes as any[]) || [];
  const specialtiesList = (specialties as any[]) || [];

  const currentSubcategory: { id: string; name: string; [key: string]: any } | null = selectedSubcategory
    ? subcategoriesList.find((s) => s.id === selectedSubcategory) || null
    : null;

  async function handleDeleteSubcategory(subcategoryId: string) {
    const name = subcategoriesList.find((s) => s.id === subcategoryId)?.name;
    if (!confirm(`⚠️ ¿Eliminar subcategoría "${name}"?\n\nEsto eliminará TODAS sus preguntas.\n\nNo se puede deshacer.`)) return;
    setDeletingId(subcategoryId); setDeleteType('subcategory');
    try {
      const r = await deleteSubcategoryAction(subcategoryId);
      if (r.success) {
        alert(`✓ Eliminado. ${r.questionCount || 0} pregunta(s) borradas.`);
        queryClient.invalidateQueries({ queryKey: ['subcategories', selectedSpecialty] });
        setSelectedSubcategory(''); setSelectedTheme('');
      } else { alert(`Error: ${r.error}`); }
    } catch { alert('Error al eliminar.'); }
    finally { setDeletingId(null); setDeleteType(null); }
  }

  async function handleDeleteTheme(themeId: string) {
    const name = themesList.find((t) => t.id === themeId)?.name;
    if (!confirm(`⚠️ ¿Eliminar tema "${name}"?\n\nEsto eliminará TODAS sus preguntas.\n\nNo se puede deshacer.`)) return;
    setDeletingId(themeId); setDeleteType('theme');
    try {
      const r = await deleteThemeAction(themeId);
      if (r.success) {
        alert(`✓ Tema eliminado. ${r.questionCount || 0} pregunta(s) borradas.`);
        queryClient.invalidateQueries({ queryKey: ['themes', selectedSubcategory] });
        setSelectedTheme('');
      } else { alert(`Error: ${r.error}`); }
    } catch { alert('Error al eliminar.'); }
    finally { setDeletingId(null); setDeleteType(null); }
  }

  async function handleResetFlashcards() {
    if (!confirm('⚠️ ¿Reiniciar progreso de Flashcards?\n\nTodas las tarjetas vuelven a estado nuevo.\n\nNo se puede deshacer.')) return;
    setIsResettingFlashcards(true);
    try {
      const r = await resetAllFlashcardsProgressAction();
      if (r.success) {
        alert(`✅ ${r.message}`);
        queryClient.invalidateQueries({ queryKey: ['flashcards'] });
        queryClient.invalidateQueries({ queryKey: ['dueFlashcards'] });
      } else { alert(`❌ ${r.message}`); }
    } catch { alert('❌ Error al reiniciar.'); }
    finally { setIsResettingFlashcards(false); }
  }

  async function handleResetPriorityScore() {
    if (!confirm('⚠️ ¿Reiniciar historial de Entrenamiento Inteligente?\n\nEsto borra todas tus respuestas pasadas.\n\nLas Flashcards y FSRS no se ven afectados.\n\nNo se puede deshacer.')) return;
    setIsResettingScore(true);
    try {
      const r = await resetPriorityScoreAction();
      if (r.success) {
        alert(`✅ ${r.message}`);
        queryClient.invalidateQueries({ queryKey: ['trainingQuestions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      } else { alert(`❌ ${r.message}`); }
    } catch { alert('❌ Error al reiniciar.'); }
    finally { setIsResettingScore(false); }
  }

  const inp = 'w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';
  const lbl = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35';
  const cardBase = 'rounded-xl border border-indigo-200/40 bg-white/60 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]';

  return (
    <div className="relative min-h-screen bg-[#f4f3ff] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      <div className="relative z-10"><Navigation /></div>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-24 pt-8 md:pb-10 lg:px-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-medium text-[#1e1b4b] dark:text-white">Configuración</h1>
          <p className="mt-1 text-[13px] text-slate-400 dark:text-white/40">
            Gestiona tu progreso y el contenido de la app.
          </p>
        </div>

        <div className="space-y-4">
          {/* Reiniciar Flashcards */}
          <div className="rounded-xl border border-indigo-300/30 bg-indigo-50/60 p-5 backdrop-blur-md dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
            <div className="mb-3">
              <p className="text-[14px] font-medium text-indigo-700 dark:text-indigo-300">⚡ Reiniciar Flashcards</p>
              <p className="mt-1 text-[13px] text-indigo-600/70 dark:text-indigo-400/70">
                Vuelve todas las tarjetas al estado inicial. El historial de respuestas no se borra.
              </p>
            </div>
            <button onClick={handleResetFlashcards} disabled={isResettingFlashcards} className="w-full rounded-xl bg-indigo-500 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
              {isResettingFlashcards ? '⏳ Reiniciando...' : '🔄 Reiniciar progreso de Flashcards'}
            </button>
          </div>

          {/* Reiniciar Entrenamiento */}
          <div className="rounded-xl border border-violet-300/30 bg-violet-50/60 p-5 backdrop-blur-md dark:border-violet-400/20 dark:bg-violet-500/[0.08]">
            <div className="mb-3">
              <p className="text-[14px] font-medium text-violet-700 dark:text-violet-300">🧠 Reiniciar Entrenamiento Inteligente</p>
              <p className="mt-1 text-[13px] text-violet-600/70 dark:text-violet-400/70">
                Borra tu historial de respuestas. Las Flashcards y FSRS no se ven afectados.
              </p>
            </div>
            <button onClick={handleResetPriorityScore} disabled={isResettingScore} className="w-full rounded-xl bg-violet-500 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
              {isResettingScore ? '⏳ Reiniciando...' : '🗑️ Reiniciar historial de respuestas'}
            </button>
          </div>

          {/* Zona de peligro — eliminar subcategorías */}
          <div className="rounded-xl border border-rose-300/40 bg-rose-50/60 p-5 backdrop-blur-md dark:border-rose-400/20 dark:bg-rose-500/[0.07]">
            <p className="mb-1 text-[14px] font-medium text-rose-700 dark:text-rose-300">⚠️ Zona de peligro</p>
            <p className="mb-4 text-[13px] text-rose-600/70 dark:text-rose-400/70">
              La eliminación es irreversible. Se borrarán todas las preguntas de la subcategoría o tema seleccionado.
            </p>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>Especialidad</label>
                <CustomSelect value={selectedSpecialty} onChange={(e) => { setSelectedSpecialty(e.target.value); setSelectedSubcategory(''); setSelectedTheme(''); }}>
                  <option value="">Selecciona...</option>
                  {specialtiesList.map((spec) => <option key={spec.id} value={spec.id}>{spec.name}</option>)}
                </CustomSelect>
              </div>
              <div>
                <label className={lbl}>Subcategoría</label>
                {!selectedSpecialty ? (
                  <div className="rounded-xl border border-rose-200/40 bg-white/40 px-4 py-2.5 text-[13px] text-rose-300 dark:border-rose-400/10 dark:bg-white/[0.02] dark:text-rose-400/40">
                    Elige especialidad primero
                  </div>
                ) : (
                  <CustomSelect value={selectedSubcategory} onChange={(e) => { setSelectedSubcategory(e.target.value); setSelectedTheme(''); }}>
                    <option value="">Selecciona...</option>
                    {subcategoriesList.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </CustomSelect>
                )}
              </div>
            </div>

            {selectedSubcategory && (
              <div className="space-y-3">
                <button onClick={() => handleDeleteSubcategory(selectedSubcategory)} disabled={deletingId === selectedSubcategory} className="w-full rounded-xl bg-rose-600 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                  {deletingId === selectedSubcategory && deleteType === 'subcategory' ? '⏳ Eliminando...' : `🗑️ Eliminar subcategoría: ${currentSubcategory?.name}`}
                </button>

                {themesList.length > 0 && (
                  <div>
                    <label className={lbl}>Eliminar tema específico</label>
                    <div className="flex gap-2">
                      <CustomSelect value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)}>
                        <option value="">Selecciona un tema...</option>
                        {themesList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </CustomSelect>
                      {selectedTheme && (
                        <button onClick={() => handleDeleteTheme(selectedTheme)} disabled={deletingId === selectedTheme} className="flex-shrink-0 rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                          {deletingId === selectedTheme ? '...' : '🗑️'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedSubcategory && (
              <p className="text-[13px] text-rose-500/60 dark:text-rose-400/40">
                Selecciona una especialidad y subcategoría para ver opciones de eliminación.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}