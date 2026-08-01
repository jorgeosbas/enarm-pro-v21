'use client';

import { useState, useEffect } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { useSubcategoriesBySpecialty } from '@/features/question-bank/hooks/useSubcategories';
import { useThemesBySubcategory } from '@/features/question-bank/hooks/useThemesBySubcategory';

interface SelectCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SelectCategoryModal({ isOpen, onClose }: SelectCategoryModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [questionCount, setQuestionCount] = useState(10);

  useEffect(() => { setMounted(true); }, []);

  const { data: specialties } = useSpecialties();
  const { data: subcategories } = useSubcategoriesBySpecialty(selectedSpecialty || null);
  const { data: themes } = useThemesBySubcategory(selectedSubcategory || null);

  function handleStudy() {
    if (!selectedSpecialty) {
      alert('Selecciona una especialidad para continuar.');
      return;
    }
    onClose();

    // Ruta base: si hay subcategoría usamos /estudiar-tema/[subcatId]
    // Si no, usamos /estudiar-flexible que acepta specialty_id
    if (selectedSubcategory) {
      const params = new URLSearchParams();
      if (selectedTheme) params.set('theme', selectedTheme);
      params.set('count', String(questionCount));
      router.push(`/estudiar-tema/${selectedSubcategory}?${params.toString()}`);
    } else {
      const params = new URLSearchParams();
      params.set('specialty', selectedSpecialty);
      params.set('count', String(questionCount));
      router.push(`/estudiar-flexible?${params.toString()}`);
    }
  }

  if (!isOpen || !mounted) return null;

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-indigo-200/40 bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0f0f1a]/90 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Título */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-[#1e1b4b] dark:text-white">
              Estudiar por tema
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/70"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Especialidad — OBLIGATORIA */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35">
              Especialidad <span className="text-rose-400">*</span>
            </label>
            <CustomSelect
              value={selectedSpecialty}
              onChange={(e) => {
                setSelectedSpecialty(e.target.value);
                setSelectedSubcategory('');
                setSelectedTheme('');
              }}
              className="w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400"
            >
              <option value="">Selecciona una especialidad...</option>
              {(specialties as any[])?.map((spec: any) => (
                <option key={spec.id} value={spec.id}>{spec.name}</option>
              ))}
            </CustomSelect>
          </div>

          {/* Subcategoría — OPCIONAL */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35">
              Subcategoría
              <span className="rounded-full border border-slate-200 bg-slate-100/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-400 dark:border-white/10 dark:bg-white/[0.04]">
                opcional
              </span>
            </label>
            {!selectedSpecialty ? (
              <div className="rounded-xl border border-indigo-100/40 bg-white/40 px-4 py-2.5 text-[13px] text-slate-300 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/20">
                Selecciona una especialidad primero
              </div>
            ) : (
              <CustomSelect
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setSelectedTheme('');
                }}
                className="w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400"
              >
                <option value="">Toda la especialidad</option>
                {(subcategories as any[])?.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </CustomSelect>
            )}
          </div>

          {/* Tema — OPCIONAL, solo si hay subcategoría */}
          {selectedSubcategory && (
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35">
                Tema
                <span className="rounded-full border border-slate-200 bg-slate-100/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-400 dark:border-white/10 dark:bg-white/[0.04]">
                  opcional
                </span>
              </label>
              {!themes || themes.length === 0 ? (
                <div className="rounded-xl border border-indigo-100/40 bg-white/40 px-4 py-2.5 text-[13px] text-slate-300 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/20">
                  Sin temas registrados en esta subcategoría
                </div>
              ) : (
                <CustomSelect
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400"
                >
                  <option value="">Todos los temas</option>
                  {(themes as any[])?.map((theme: any) => (
                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                  ))}
                </CustomSelect>
              )}
            </div>
          )}

          {/* Cantidad de preguntas */}
          <div className="mb-6">
            <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35">
              Número de preguntas
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400"
            />
            <p className="mt-1 text-[11px] text-slate-400 dark:text-white/25">
              Si hay menos preguntas disponibles se mostrarán todas.
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={handleStudy}
              disabled={!selectedSpecialty}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Estudiar
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-indigo-200/40 bg-white/60 px-4 py-2.5 text-[14px] text-slate-600 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}