'use client';

import { useState, useRef } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { parseQuestionsText } from '@/features/question-bank/domain/parseQuestions';
import type { ParseResult } from '@/features/question-bank/types';
import { importQuestionsAction, type ImportSummary } from './actions';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { useSubcategoriesBySpecialty } from '@/features/question-bank/hooks/useSubcategories';
import { useThemesBySubcategory } from '@/features/question-bank/hooks/useThemesBySubcategory';
import { CreateCategoryModal } from '@/components/CreateCategoryModal';

const PLACEHOLDER = `P: Hombre de 58 años, hipertenso y tabaquista, con dolor torácico opresivo de 2h irradiado a brazo izquierdo y diaforesis. ECG con elevación del ST en II, III y aVF. ¿Diagnóstico más probable?
A) Angina inestable
B) Infarto agudo de miocardio de cara anterior
*C) Infarto agudo de miocardio de cara inferior con elevación del ST
D) Pericarditis aguda
EXPLICACION: La elevación del ST en II, III y aVF localiza la isquemia en cara inferior.

===

P: Siguiente pregunta...
A) Opción 1
*B) Opción 2
C) Opción 3`;

export default function ImportarPage() {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: specialties } = useSpecialties();
  const { data: subcategories } = useSubcategoriesBySpecialty(selectedSpecialty || null);
  const { data: themes } = useThemesBySubcategory(selectedSubcategory || null);

  function handlePreview() {
    setSummary(null);
    setPreview(parseQuestionsText(text));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setPreview(parseQuestionsText(content));
    setSummary(null);
  }

  async function handleConfirm() {
    if (!preview || preview.questions.length === 0 || !selectedSubcategory) return;
    setImporting(true);
    const result = await importQuestionsAction(text, selectedSubcategory, selectedTheme || null);
    setImporting(false);
    setSummary(result);
    if (result.inserted > 0) {
      setText('');
      setPreview(null);
      setSelectedSubcategory('');
      setSelectedTheme('');
      setTimeout(() => { router.push('/banco-preguntas'); router.refresh(); }, 2000);
    }
  }

  function handleCategoryCreated(type: 'subcategory' | 'theme', id: string, name: string) {
    if (type === 'subcategory') {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['themes', selectedSubcategory] });
    }
  }

  const lbl = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/35';
  const cardBase = 'rounded-xl border border-indigo-300/50 bg-white/70 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]';

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-8 md:pb-10 lg:px-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-medium text-[#1e1b4b] dark:text-white">Importar preguntas</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-white/40">
            Selecciona especialidad, subcategoría y tema, luego pega tus preguntas.
          </p>
        </div>

        <div className="space-y-4">
          {/* Selectores de categoría */}
          <div className={cardBase}>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">
              Categorización
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={lbl}>Especialidad <span className="text-rose-500">*</span></label>
                <CustomSelect value={selectedSpecialty} onChange={(e) => { setSelectedSpecialty(e.target.value); setSelectedSubcategory(''); setSelectedTheme(''); }}>
                  <option value="">Selecciona...</option>
                  {(specialties as any[])?.map((spec: any) => <option key={spec.id} value={spec.id}>{spec.name}</option>)}
                </CustomSelect>
              </div>

              <div>
                <label className={lbl}>Subcategoría <span className="text-rose-500">*</span></label>
                {!selectedSpecialty ? (
                  <div className="rounded-xl border border-indigo-200/50 bg-white/50 px-4 py-2.5 text-[13px] text-slate-400 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/20">
                    Elige especialidad primero
                  </div>
                ) : (
                  <CustomSelect value={selectedSubcategory} onChange={(e) => { setSelectedSubcategory(e.target.value); setSelectedTheme(''); }}>
                    <option value="">Selecciona...</option>
                    {(subcategories as any[])?.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
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
                    <option value="">Sin tema</option>
                    {(themes as any[])?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </CustomSelect>
                )}
              </div>
            </div>

            {/* Botón para abrir modal de creación */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-300/60 bg-indigo-100/60 px-3 py-1.5 text-[12px] font-medium text-indigo-700 backdrop-blur-md transition-colors hover:bg-indigo-100/85 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Crear subcategoría o tema
              </button>
            </div>
          </div>

          {/* Área de texto */}
          <div className={cardBase}>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">
              Preguntas
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={10}
              className="w-full rounded-xl border border-indigo-300/50 bg-white/75 px-4 py-3 font-mono text-[12px] leading-relaxed text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400"
            />
            <div className="mt-3 flex gap-2">
              <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-indigo-300/50 bg-white/65 px-4 py-2 text-[13px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
                📁 Archivo
              </button>
              <button onClick={handlePreview} disabled={!text} className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                👁️ Vista previa
              </button>
            </div>
          </div>

          {/* Vista previa */}
          {preview && (
            <div className="rounded-xl border border-indigo-300/45 bg-indigo-100/55 p-5 backdrop-blur-md dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Vista previa
              </p>
              {preview.errors.length > 0 && (
                <div className="mb-3 space-y-1">
                  {preview.errors.map((err, idx) => (
                    <p key={idx} className="text-[13px] text-rose-600 dark:text-rose-400">❌ {err.message}</p>
                  ))}
                </div>
              )}
              <p className="mb-4 text-[13px] text-indigo-700 dark:text-indigo-300">
                ✓ {preview.questions.length} pregunta(s) lista(s) para importar
              </p>
              {selectedSubcategory && (
                <button onClick={handleConfirm} disabled={importing || preview.errors.length > 0} className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                  {importing ? 'Importando...' : '✓ Confirmar e importar'}
                </button>
              )}
              {!selectedSubcategory && (
                <p className="text-[13px] text-indigo-600 dark:text-indigo-400">
                  Selecciona una subcategoría arriba para importar.
                </p>
              )}
            </div>
          )}

          {/* Resultado */}
          {summary && (
            <div className={`p-5 ${summary.inserted > 0 ? 'rounded-xl border border-emerald-300/50 bg-emerald-100/55 backdrop-blur-md dark:border-emerald-400/20 dark:bg-emerald-500/[0.07]' : 'rounded-xl border border-rose-300/50 bg-rose-100/55 backdrop-blur-md dark:border-rose-400/20 dark:bg-rose-500/[0.07]'}`}>
              <p className={`mb-1 text-[14px] font-medium ${summary.inserted > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {summary.inserted > 0 ? '✓ Importación exitosa' : '❌ Sin preguntas importadas'}
              </p>
              <p className="text-[13px] text-slate-700 dark:text-white/50">
                {summary.inserted} importadas · {summary.failed} error(es)
              </p>
              {summary.errorMessages.slice(0, 3).map((msg, i) => (
                <p key={i} className="mt-1 text-[12px] text-slate-600 dark:text-white/35">• {msg}</p>
              ))}
            </div>
          )}
        </div>
      </main>
      <CreateCategoryModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultSubcategoryId={selectedSubcategory || undefined}
        onCreated={handleCategoryCreated}
      />
    </div>
  );
}