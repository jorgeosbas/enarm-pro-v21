'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
export default function ResultadoSimuladorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const correct = parseInt(searchParams.get('correct') || '0');
  const total = parseInt(searchParams.get('total') || '1');
  const theme = searchParams.get('theme') || 'Simulador';

  const percentage = Math.round((correct / total) * 100);

  // Retrasamos un poco la aparición del número para que la animación de "count-up"
  // se note claramente, en vez de mezclarse con el fade-in del círculo que lo envuelve.
  const [showPercentage, setShowPercentage] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowPercentage(true), 250);
    return () => clearTimeout(t);
  }, []);

  const { color, ring, label, emoji } =
    percentage >= 80
      ? { color: 'text-emerald-600 dark:text-emerald-400', ring: 'from-emerald-500 to-emerald-400', label: '¡Excelente dominio!', emoji: '🏆' }
      : percentage >= 60
        ? { color: 'text-amber-600 dark:text-amber-400', ring: 'from-amber-500 to-amber-400', label: 'Buen trabajo, sigue así.', emoji: '📈' }
        : { color: 'text-rose-600 dark:text-rose-400', ring: 'from-rose-600 to-rose-400', label: 'Hay espacio para mejorar.', emoji: '💪' };

  const tip =
    percentage < 60
      ? 'Revisa el banco de preguntas y usa el Entrenamiento Inteligente para reforzar este tema.'
      : percentage < 80
        ? 'Buen nivel. Un Quiz Inteligente te ayudará a identificar los puntos débiles restantes.'
        : 'Excelente. Continúa con otros temas o intenta un Simulador más largo para consolidar.';

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      

      <main className="relative z-10 mx-auto max-w-lg px-4 pb-24 pt-10 md:pb-10">
        {/* Encabezado */}
        <div className="mb-6 text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">{theme}</p>
          <h1 className="mt-1 text-[22px] font-medium text-[#1e1b4b] dark:text-white">Resultados</h1>
        </div>

        {/* Score circular */}
        <div className="mb-6 flex flex-col items-center animate-slide-up">
          <div className={`relative mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${ring} p-1`}>
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white dark:bg-[#0a0a14]">
              {showPercentage && (
                <span className={`text-4xl font-medium animate-count-up ${color}`}>{percentage}%</span>
              )}
            </div>
          </div>
          <p className="text-[16px] font-medium text-[#1e1b4b] dark:text-white">{emoji} {label}</p>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-white/40">{correct} de {total} correctas</p>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Aciertos', value: correct, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Errores', value: total - correct, color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Total', value: total, color: 'text-slate-700 dark:text-white/70' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-indigo-300/50 bg-white/70 p-4 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/30">{s.label}</p>
              <p className={`text-2xl font-medium ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="mb-6 rounded-xl border border-amber-300/50 bg-amber-100/55 p-4 backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-500/[0.07]">
          <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200/70">
            <span className="font-medium text-amber-700 dark:text-amber-300">💡 </span>
            {tip}
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Volver al dashboard
          </button>
          <Link
            href="/banco-preguntas"
            className="flex-1 rounded-xl border border-indigo-300/50 bg-white/65 py-3 text-center text-[14px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50"
          >
            Banco de preguntas
          </Link>
        </div>
      </main>
    </div>
  );
}