'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserProfile } from '@/features/question-bank/hooks/useUserProfile';
import { saveUserProfileAction } from '@/features/question-bank/actions/saveProfile';
import { Navigation } from '@/components/Navigation';

export default function PerfilPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useUserProfile();

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'O' | null>(null);
  const [specialty, setSpecialty] = useState('');
  const [targetExamDate, setTargetExamDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setGender(profile.gender || null);
      setSpecialty(profile.specialty || '');
      setTargetExamDate(profile.target_exam_date || '');
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveUserProfileAction(fullName, gender, specialty, targetExamDate);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      await queryClient.refetchQueries({ queryKey: ['userProfile'] });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Hubo un error al guardar tu perfil. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full rounded-xl border border-indigo-300/50 bg-white/75 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';
  const lbl = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/35';

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />
      <div className="pointer-events-none fixed bottom-[20px] left-[160px] h-[220px] w-[220px] rounded-full bg-cyan-400/12 dark:bg-cyan-400/10" style={{ filter: 'blur(70px)' }} />

      <div className="relative z-10"><Navigation /></div>

      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-24 pt-8 md:pb-10 lg:px-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-medium text-[#1e1b4b] dark:text-white">Mi perfil</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-white/40">
            Tu nombre aparecerá como "Dr." o "Dra." en el menú superior.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-indigo-300/50 bg-white/70 p-8 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="text-[13px] text-slate-500 dark:text-white/30">Cargando perfil...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Datos personales */}
            <div className="rounded-xl border border-indigo-300/50 bg-white/70 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
              <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">
                Datos personales
              </p>
              <div className="space-y-4">
                <div>
                  <label className={lbl}>Nombre completo</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" className={inp} />
                </div>

                <div>
                  <label className={lbl}>Género</label>
                  <div className="flex gap-4">
                    {[
                      { value: 'M', label: 'Hombre (Dr.)' },
                      { value: 'F', label: 'Mujer (Dra.)' },
                      { value: 'O', label: 'Otro' },
                    ].map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="gender"
                          value={opt.value}
                          checked={gender === opt.value}
                          onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'O')}
                          className="h-4 w-4 accent-indigo-500"
                        />
                        <span className="text-[13px] text-slate-700 dark:text-white/60">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={lbl}>Especialidad aspirante</label>
                  <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ej: Medicina Interna, Cirugía..." className={inp} />
                </div>
              </div>
            </div>

            {/* Fecha ENARM */}
            <div className="rounded-xl border border-indigo-300/50 bg-white/70 p-5 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
              <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">
                Fecha del ENARM
              </p>
              <div>
                <label className={lbl}>Fecha del examen</label>
                <input type="date" value={targetExamDate} onChange={(e) => setTargetExamDate(e.target.value)} className={inp} />
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/25">
                  Aparecerá como cuenta regresiva en tu dashboard.
                </p>
              </div>
            </div>

            {/* Éxito */}
            {saved && (
              <div className="rounded-xl border border-emerald-300/50 bg-emerald-100/55 px-5 py-3 text-[13px] text-emerald-700 backdrop-blur-md dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
                ✓ Perfil guardado exitosamente.
              </div>
            )}

            {/* Guardar */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
