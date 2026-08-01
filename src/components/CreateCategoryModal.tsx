'use client';

import { useState, useEffect } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { useSubcategoriesBySpecialty } from '@/features/question-bank/hooks/useSubcategories';
import { createSubcategoryAction } from '@/features/question-bank/actions/createSubcategory';
import { createThemeAction } from '@/features/question-bank/actions/createTheme';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Subcategoría preseleccionada (para abrir directo en tab de tema) */
  defaultSubcategoryId?: string;
  /** Callback cuando se crea algo, para actualizar selects del padre */
  onCreated?: (type: 'subcategory' | 'theme', id: string, name: string) => void;
}

type Tab = 'subcategory' | 'theme';

export function CreateCategoryModal({
  isOpen,
  onClose,
  defaultSubcategoryId,
  onCreated,
}: CreateCategoryModalProps) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(defaultSubcategoryId ? 'theme' : 'subcategory');

  // Subcategoría
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [subcatName, setSubcatName] = useState('');
  const [savingSubcat, setSavingSubcat] = useState(false);
  const [subcatError, setSubcatError] = useState<string | null>(null);
  const [subcatSuccess, setSubcatSuccess] = useState(false);

  // Tema
  const [selectedSubcat, setSelectedSubcat] = useState(defaultSubcategoryId || '');
  const [themeName, setThemeName] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeSuccess, setThemeSuccess] = useState(false);

  const { data: specialties } = useSpecialties();
  const { data: subcategories } = useSubcategoriesBySpecialty(selectedSpecialty || null);

  // Cargar todas las subcats para el selector de tema
  const [allSpecialty, setAllSpecialty] = useState('');
  const { data: allSubcats } = useSubcategoriesBySpecialty(allSpecialty || null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (defaultSubcategoryId) {
      setTab('theme');
      setSelectedSubcat(defaultSubcategoryId);
    }
  }, [defaultSubcategoryId]);

  function resetState() {
    setSubcatName(''); setSubcatError(null); setSubcatSuccess(false);
    setThemeName(''); setThemeError(null); setThemeSuccess(false);
    setSelectedSpecialty(''); setSelectedSubcat(''); setAllSpecialty('');
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleCreateSubcategory() {
    if (!selectedSpecialty || !subcatName.trim()) {
      setSubcatError('Selecciona una especialidad e ingresa un nombre.');
      return;
    }
    setSavingSubcat(true); setSubcatError(null);
    try {
      const data = await createSubcategoryAction(selectedSpecialty, subcatName.trim());
      queryClient.invalidateQueries({ queryKey: ['subcategories', selectedSpecialty] });
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      setSubcatSuccess(true);
      onCreated?.('subcategory', data.id, data.name);
      setTimeout(() => { setSubcatSuccess(false); setSubcatName(''); }, 2000);
    } catch (err: any) {
      setSubcatError(err.message || 'Error al crear subcategoría');
    } finally {
      setSavingSubcat(false);
    }
  }

  async function handleCreateTheme() {
    if (!selectedSubcat || !themeName.trim()) {
      setThemeError('Selecciona una subcategoría e ingresa un nombre de tema.');
      return;
    }
    setSavingTheme(true); setThemeError(null);
    try {
      const result = await createThemeAction(selectedSubcat, themeName.trim());
      if (result.success && result.id) {
        queryClient.invalidateQueries({ queryKey: ['themes', selectedSubcat] });
        setThemeSuccess(true);
        onCreated?.('theme', result.id, themeName.trim());
        setTimeout(() => { setThemeSuccess(false); setThemeName(''); }, 2000);
      } else {
        setThemeError(result.error || 'Error al crear tema');
      }
    } catch (err: any) {
      setThemeError(err.message || 'Error al crear tema');
    } finally {
      setSavingTheme(false);
    }
  }

  if (!isOpen || !mounted) return null;

  const inp = 'w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';
  const lbl = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35';

  const modal = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-indigo-200/40 bg-white/85 p-6 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0f0f1a]/95 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-[#1e1b4b] dark:text-white">
              Crear categoría
            </h2>
            <button onClick={handleClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/70">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex rounded-xl border border-indigo-100/50 bg-indigo-50/40 p-1 dark:border-white/[0.06] dark:bg-white/[0.03]">
            {([
              { id: 'subcategory' as Tab, label: 'Subcategoría' },
              { id: 'theme' as Tab, label: 'Tema' },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${
                  tab === id
                    ? 'bg-white shadow-sm text-indigo-600 dark:bg-white/10 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Subcategoría */}
          {tab === 'subcategory' && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Especialidad</label>
                <CustomSelect value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)}>
                  <option value="">Selecciona una especialidad...</option>
                  {specialties?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </CustomSelect>
              </div>
              <div>
                <label className={lbl}>Nombre de la subcategoría</label>
                <input type="text" value={subcatName} onChange={(e) => setSubcatName(e.target.value)} placeholder="Ej: Cardiología, Neurología..." className={inp} />
              </div>
              {subcatError && (
                <div className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
                  {subcatError}
                </div>
              )}
              {subcatSuccess && (
                <div className="rounded-xl border border-emerald-300/40 bg-emerald-50/60 px-4 py-3 text-[13px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
                  ✓ Subcategoría creada exitosamente
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={handleCreateSubcategory} disabled={savingSubcat || !selectedSpecialty || !subcatName.trim()} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                  {savingSubcat ? 'Creando...' : 'Crear subcategoría'}
                </button>
                <button onClick={handleClose} className="rounded-xl border border-indigo-200/40 bg-white/60 px-4 py-2.5 text-[14px] text-slate-600 backdrop-blur-md hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tab: Tema */}
          {tab === 'theme' && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Especialidad (para filtrar)</label>
                <CustomSelect value={allSpecialty} onChange={(e) => { setAllSpecialty(e.target.value); setSelectedSubcat(''); }}>
                  <option value="">Selecciona una especialidad...</option>
                  {specialties?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </CustomSelect>
              </div>
              <div>
                <label className={lbl}>Subcategoría</label>
                {!allSpecialty ? (
                  <div className="rounded-xl border border-indigo-100/40 bg-white/40 px-4 py-2.5 text-[13px] text-slate-300 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/20">
                    Elige una especialidad primero
                  </div>
                ) : (
                  <CustomSelect value={selectedSubcat} onChange={(e) => setSelectedSubcat(e.target.value)}>
                    <option value="">Selecciona una subcategoría...</option>
                    {(allSubcats as any[])?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </CustomSelect>
                )}
              </div>
              <div>
                <label className={lbl}>Nombre del tema</label>
                <input type="text" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Ej: Arritmias, Diabetes tipo 2..." className={inp} />
              </div>
              {themeError && (
                <div className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
                  {themeError}
                </div>
              )}
              {themeSuccess && (
                <div className="rounded-xl border border-emerald-300/40 bg-emerald-50/60 px-4 py-3 text-[13px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
                  ✓ Tema creado exitosamente
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={handleCreateTheme} disabled={savingTheme || !selectedSubcat || !themeName.trim()} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                  {savingTheme ? 'Creando...' : 'Crear tema'}
                </button>
                <button onClick={handleClose} className="rounded-xl border border-indigo-200/40 bg-white/60 px-4 py-2.5 text-[14px] text-slate-600 backdrop-blur-md hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
