'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { createSubcategoryAction } from '@/features/question-bank/actions/createSubcategory';
import { Navigation } from '@/components/Navigation';

export default function CrearSubcategoriaPage() {
  const router = useRouter();
  const { data: specialties, isLoading: specialtiesLoading } = useSpecialties();
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    if (!selectedSpecialty || !subcategoryName.trim()) {
      setError('Debes seleccionar una especialidad e ingresar un nombre');
      setSaving(false);
      return;
    }
    try {
      await createSubcategoryAction(selectedSpecialty, subcategoryName.trim(), description.trim());
      setSuccess(true);
      setSubcategoryName('');
      setDescription('');
      setSelectedSpecialty('');
      setTimeout(() => { router.push('/importar'); router.refresh(); }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al crear la subcategoría');
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';
  const lbl = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35';

  return (
    <div className="relative min-h-screen bg-[#f4f3ff] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      <div className="relative z-10"><Navigation /></div>

      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-24 pt-8 md:pb-10 lg:px-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-medium text-[#1e1b4b] dark:text-white">Crear subcategoría</h1>
          <p className="mt-1 text-[13px] text-slate-400 dark:text-white/40">
            Define un nuevo tema de estudio dentro de una especialidad.
          </p>
        </div>

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 px-5 py-3 text-[13px] text-emerald-700 backdrop-blur-md dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
            ✓ Subcategoría creada. Redirigiendo al importador…
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200/40 bg-white/60 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">
              Nueva subcategoría
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={lbl}>Especialidad</label>
                {specialtiesLoading ? (
                  <div className="h-10 animate-pulse rounded-xl bg-indigo-100/40 dark:bg-white/[0.05]" />
                ) : (
                  <select value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} className={inp}>
                    <option value="">Selecciona una especialidad...</option>
                    {specialties?.map((spec) => (
                      <option key={spec.id} value={spec.id}>{spec.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={lbl}>Nombre de la subcategoría</label>
                <input type="text" value={subcategoryName} onChange={(e) => setSubcategoryName(e.target.value)} placeholder="Ej: Cardiología, Neurología..." className={inp} />
              </div>

              <div>
                <label className={lbl}>
                  Descripción
                  <span className="ml-2 rounded-full border border-slate-200 bg-slate-100/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-400 dark:border-white/10 dark:bg-white/[0.04]">opcional</span>
                </label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notas sobre esta subcategoría..." rows={3} className={`${inp} resize-none`} />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Creando...' : 'Crear subcategoría'}
                </button>
                <button type="button" onClick={() => router.back()} disabled={saving} className="rounded-xl border border-indigo-200/40 bg-white/60 px-5 py-2.5 text-[14px] text-slate-600 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>

          {/* Tip */}
          <div className="rounded-xl border border-amber-300/30 bg-amber-50/60 p-5 backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-500/[0.07]">
            <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-200/70">
              <span className="font-medium text-amber-700 dark:text-amber-300">💡 Consejo:</span>{' '}
              Crea la subcategoría primero (ej: "Cardiología" dentro de "Medicina Interna") y luego importa las preguntas desde el importador.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
