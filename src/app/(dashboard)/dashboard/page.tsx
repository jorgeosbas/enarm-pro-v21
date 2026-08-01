'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { SelectCategoryModal } from '@/components/SelectCategoryModal';
import { SelectQuestionCountModal } from '@/components/SelectQuestionCountModal';
import { useRandomQuestionsFromAll } from '@/features/question-bank/hooks/useRandomQuestions';
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats';
import { useUserProfile } from '@/features/question-bank/hooks/useUserProfile';
import {
  buildDailyRecommendation,
  buildInsights,
  buildProgressMetrics,
  type StudyMode,
} from '@/features/dashboard/engine/recommendations';

// ─── Helpers visuales ────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'Doc';
  const firstName = fullName.trim().split(' ')[0];
  return firstName || 'Doc';
}

function getCountdown(examDateStr: string | null | undefined) {
  if (!examDateStr) return null;
  const exam = new Date(examDateStr);
  exam.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: 0, label: 'El ENARM ya pasó' };
  if (diff === 0) return { days: 0, label: '¡Hoy es el ENARM!' };
  return { days: diff, label: `días para el ENARM` };
}

function shortName(name: string): string {
  const map: Record<string, string> = {
    'Medicina Interna': 'Interna', 'Cirugía General': 'Cirugía',
    'Ginecología y Obstetricia': 'Gineco.', Pediatría: 'Pediatría',
    Cardiología: 'Cardio.', Neumología: 'Neumo.',
    Endocrinología: 'Endocri.', Neurología: 'Neuro.',
  };
  return map[name] || name.split(' ')[0] || name;
}

const metricColorMap: Record<string, string> = {
  indigo: 'text-indigo-500 dark:text-indigo-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-500 dark:text-amber-400',
  violet: 'text-violet-500 dark:text-violet-400',
};

// ─── Iconos de modos ─────────────────────────────────────────────────────────

function IconFlashcards() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
function IconEntrenamiento() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function IconSimulador() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
    </svg>
  );
}
function IconTema() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

const modeIcon: Record<StudyMode, React.ReactNode> = {
  flashcards: <IconFlashcards />,
  entrenamiento: <IconEntrenamiento />,
  simulador: <IconSimulador />,
  tema: <IconTema />,
};

// ─── Componente mini gráfico de evolución ────────────────────────────────────

function EvoChart({ data }: { data: Array<{ date: string; accuracy: number; total: number }> }) {
  if (!data || data.length < 3) {
    return (
      <p className="py-6 text-center text-[12px] text-slate-400 dark:text-white/30">
        Responde más preguntas para ver tu evolución aquí.
      </p>
    );
  }

  const max = 100;
  const h = 64;
  const w = 100;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (d.accuracy / max) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `0,${h} ${polyline} ${w},${h}`;

  const last = data[data.length - 1];
  const first = data[0];
  const trend = (last?.accuracy ?? 0) - (first?.accuracy ?? 0);
  const trendColor = trend >= 0 ? 'text-emerald-500' : 'text-rose-500';
  const trendLabel = trend >= 0 ? `+${trend}pp` : `${trend}pp`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] text-slate-400 dark:text-white/30">Últimos 30 días</p>
        <span className={`text-[11px] font-medium ${trendColor}`}>{trendLabel} vs inicio</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 64 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#areaGrad)" />
        <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between">
        <p className="text-[10px] text-slate-400 dark:text-white/25">{first?.date ? first.date.slice(5) : ''}</p>
        <p className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400">{last?.accuracy ?? 0}% hoy</p>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [simuladorModalOpen, setSimuladorModalOpen] = useState(false);
  const [entrenamientoModalOpen, setEntrenamientoModalOpen] = useState(false);

  const { data: allQuestions } = useRandomQuestionsFromAll();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: profile } = useUserProfile();

  const recommendation = useMemo(() => buildDailyRecommendation(stats, isLoading), [stats, isLoading]);
  const insights = useMemo(() => buildInsights(stats), [stats]);
  const progressMetrics = useMemo(() => buildProgressMetrics(stats), [stats]);
  const countdown = getCountdown(profile?.target_exam_date);

  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = getFirstName(profile?.full_name);

  function handleRecommendationCTA() {
    switch (recommendation.mode) {
      case 'flashcards': router.push('/flashcards'); break;
      case 'entrenamiento': setEntrenamientoModalOpen(true); break;
      case 'simulador': setSimuladorModalOpen(true); break;
      case 'tema': setCategoryModalOpen(true); break;
    }
  }

  const cardBase = 'rounded-xl border border-indigo-200/40 bg-white/60 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]';

  return (
    <div className="relative min-h-screen bg-[#f4f3ff] dark:bg-[#0a0a14]">
      {/* Blobs de fondo */}
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />
      <div className="pointer-events-none fixed bottom-[20px] left-[160px] h-[220px] w-[220px] rounded-full bg-cyan-400/12 dark:bg-cyan-400/10" style={{ filter: 'blur(70px)' }} />

      <div className="relative z-10"><Navigation /></div>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-6 md:pb-10 lg:px-6">

        {/* Saludo */}
        <div className="mb-5">
          <h1 className="text-xl font-medium text-[#1e1b4b] dark:text-white md:text-2xl">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="mt-1 text-[13px] text-slate-400 dark:text-white/40">{today}</p>
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">

          {/* ── Columna principal ─────────────────────────────────── */}
          <div className="flex-1 space-y-5">

            {/* ① HERO — Qué hacer hoy */}
            <div className={`relative overflow-hidden p-5 md:p-6 ${cardBase} ${
              recommendation.isNewUser
                ? 'border-violet-200/40 dark:border-violet-400/20'
                : 'border-indigo-300/30 bg-indigo-500/10 dark:border-indigo-400/20 dark:bg-indigo-500/10'
            }`}>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-400/10 to-purple-400/6" />
              <div className="relative">
                {/* Etiqueta */}
                <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-indigo-500/70 dark:text-indigo-400/60">
                  {recommendation.isNewUser ? 'Comenzar' : 'Para hoy'}
                </p>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="mb-1 text-[17px] font-medium text-[#1e1b4b] dark:text-white">
                      {recommendation.title}
                    </h2>
                    <p className="mb-4 text-[13px] text-slate-500 dark:text-white/50">
                      {recommendation.description}
                    </p>

                    {/* Items de la sesión */}
                    <ul className="mb-4 space-y-1">
                      {recommendation.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-[13px] text-[#1e1b4b] dark:text-white/80">
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* Tiempo estimado */}
                    <p className="mb-5 text-[12px] text-slate-400 dark:text-white/35">
                      Tiempo estimado: ~{recommendation.estimatedMinutes} min
                    </p>

                    {/* CTA */}
                    <button
                      onClick={handleRecommendationCTA}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    >
                      {recommendation.isNewUser ? 'Comenzar ahora' : 'Comenzar entrenamiento'}
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <polyline points="9,18 15,12 9,6" />
                      </svg>
                    </button>
                  </div>

                  {/* Ícono del modo */}
                  <div className="hidden flex-shrink-0 md:flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200/40 bg-white/50 text-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <div className="scale-125">{modeIcon[recommendation.mode]}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ② MI PROGRESO — 4 métricas */}
            {progressMetrics.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">
                  Mi progreso
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-slide-up">
                  {progressMetrics.map((m) => (
                    <div key={m.label} className={`${cardBase} p-3`}>
                      <p className="mb-1 text-[11px] text-slate-400 dark:text-white/30">{m.icon} {m.label}</p>
                      <p className={`text-xl font-medium ${metricColorMap[m.color] ?? 'text-indigo-500'}`}>{m.value}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-white/25">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ③ INSIGHTS */}
            {insights.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">
                  Insights
                </p>
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className={`${cardBase} flex items-start gap-3 px-4 py-3`}>
                      <span className="mt-0.5 flex-shrink-0 text-[16px]">{ins.icon}</span>
                      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-white/65">{ins.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ④ MODOS DE ESTUDIO */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">
                Modos de estudio
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Entrenamiento */}
                <button
                  onClick={() => setEntrenamientoModalOpen(true)}
                  disabled={!allQuestions?.length}
                  className={`${cardBase} flex cursor-pointer items-start gap-3 p-4 text-left transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.07]`}
                >
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-500 dark:bg-white/[0.07] dark:text-indigo-400">
                    <IconEntrenamiento />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/85">Quiz Inteligente</p>
                    <p className="text-[11px] text-slate-400 dark:text-white/35">Aprende lo que más necesitas.</p>
                  </div>
                </button>

                {/* Por tema */}
                <button
                  onClick={() => setCategoryModalOpen(true)}
                  className={`${cardBase} flex cursor-pointer items-start gap-3 p-4 text-left transition-colors hover:bg-white/80 dark:hover:bg-white/[0.07]`}
                >
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-500 dark:bg-white/[0.07] dark:text-indigo-400">
                    <IconTema />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/85">Quiz por Tema</p>
                    <p className="text-[11px] text-slate-400 dark:text-white/35">Estudia exactamente lo que quieras.</p>
                  </div>
                </button>

                {/* Simulador */}
                <button
                  onClick={() => setSimuladorModalOpen(true)}
                  disabled={!allQuestions?.length}
                  className={`${cardBase} flex cursor-pointer items-start gap-3 p-4 text-left transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.07]`}
                >
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-500 dark:bg-white/[0.07] dark:text-indigo-400">
                    <IconSimulador />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/85">Simulador</p>
                    <p className="text-[11px] text-slate-400 dark:text-white/35">Evalúa tu preparación.</p>
                  </div>
                </button>

                {/* Flashcards */}
                <Link
                  href="/flashcards"
                  className={`${cardBase} flex items-start gap-3 p-4 transition-colors hover:bg-white/80 dark:hover:bg-white/[0.07]`}
                >
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-500 dark:bg-white/[0.07] dark:text-indigo-400">
                    <IconFlashcards />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/85">Flashcards</p>
                    <p className="text-[11px] text-slate-400 dark:text-white/35">Evita olvidar lo aprendido.</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* ⑤ EVOLUCIÓN — gráfico */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">
                Evolución
              </p>
              <div className={`${cardBase} p-4`}>
                <EvoChart data={stats?.dailyAccuracy || []} />
              </div>
            </div>

          </div>{/* fin columna principal */}

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <div className="hidden w-[252px] flex-shrink-0 space-y-4 md:block">

            {/* Countdown */}
            {countdown && (
              <div className={`${cardBase} p-4`}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">Cuenta regresiva</p>
                {countdown.days === 0 ? (
                  <p className="text-[14px] font-medium text-indigo-600 dark:text-indigo-400">{countdown.label}</p>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="bg-gradient-to-br from-indigo-500 to-purple-400 bg-clip-text text-4xl font-medium text-transparent dark:from-white dark:to-purple-300">
                      {countdown.days}
                    </span>
                    <span className="text-[12px] text-slate-400 dark:text-white/40">{countdown.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Racha */}
            <div className={`${cardBase} p-4`}>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">🔥 Racha</p>
              <p className="text-3xl font-medium text-indigo-500 dark:text-indigo-400">
                {isLoading ? '—' : stats?.streakDays ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">días seguidos</p>
            </div>

            {/* Mejor especialidad */}
            {stats?.specialtyStats?.length ? (() => {
              const best = [...stats.specialtyStats]
                .filter(s => s.total >= 5)
                .sort((a, b) => b.accuracy - a.accuracy)[0];
              if (!best?.name) return null;
              return (
                <div className={`${cardBase} p-4`}>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">🏆 Mejor especialidad</p>
                  <p className="text-[14px] font-medium text-emerald-600 dark:text-emerald-400">{shortName(best.name)}</p>
                  <p className="text-[12px] text-slate-400 dark:text-white/30">{best.accuracy}% de aciertos</p>
                </div>
              );
            })() : null}

            {/* Especialidad a reforzar */}
            {stats?.specialtyStats?.length ? (() => {
              const worst = [...stats.specialtyStats]
                .filter(s => s.total >= 5 && s.accuracy < 70)
                .sort((a, b) => a.accuracy - b.accuracy)[0];
              if (!worst?.name) return null;
              return (
                <div className={`${cardBase} p-4`}>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">⚠️ A reforzar</p>
                  <p className="text-[14px] font-medium text-amber-600 dark:text-amber-400">{shortName(worst.name)}</p>
                  <p className="text-[12px] text-slate-400 dark:text-white/30">{worst.accuracy}% de aciertos</p>
                </div>
              );
            })() : null}

            {/* Banco */}
            <div className={`${cardBase} p-4`}>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/30">📚 Banco</p>
              <p className="text-3xl font-medium text-amber-500 dark:text-amber-400">
                {isLoading ? '—' : stats?.totalQuestions ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">preguntas importadas</p>
            </div>

          </div>{/* fin sidebar */}
        </div>

        {/* ── Mobile: sidebar info debajo ──────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:hidden">
          {countdown && (
            <div className={`${cardBase} p-3`}>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/30">📅 ENARM</p>
              <p className="text-xl font-medium text-indigo-500 dark:text-indigo-400">{countdown.days}</p>
              <p className="text-[10px] text-slate-400 dark:text-white/30">días restantes</p>
            </div>
          )}
          <div className={`${cardBase} p-3`}>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/30">📚 Banco</p>
            <p className="text-xl font-medium text-amber-500 dark:text-amber-400">{stats?.totalQuestions ?? 0}</p>
            <p className="text-[10px] text-slate-400 dark:text-white/30">preguntas</p>
          </div>
        </div>

      </main>

      {/* Modales */}
      <SelectCategoryModal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} />
      <SelectQuestionCountModal
        isOpen={simuladorModalOpen}
        onClose={() => setSimuladorModalOpen(false)}
        maxQuestions={allQuestions?.length || 0}
      />
      <SelectQuestionCountModal
        isOpen={entrenamientoModalOpen}
        onClose={() => setEntrenamientoModalOpen(false)}
        maxQuestions={allQuestions?.length || 0}
        redirectTo="/entrenamiento"
      />
    </div>
  );
}