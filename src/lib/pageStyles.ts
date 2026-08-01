/**
 * Clases Tailwind compartidas para todas las páginas internas.
 * Mantiene el glassmorphism consistente con el Dashboard.
 */

export const page = {
  wrapper: 'relative min-h-screen bg-[#f4f3ff] dark:bg-[#0a0a14]',
  main: 'relative z-10 mx-auto max-w-3xl px-4 pb-24 pt-8 md:pb-10 lg:px-6',
  mainWide: 'relative z-10 mx-auto max-w-5xl px-4 pb-24 pt-8 md:pb-10 lg:px-6',
} as const;

export const card = {
  base: 'rounded-xl border border-indigo-200/40 bg-white/60 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]',
  p: 'p-5',
  danger: 'rounded-xl border border-rose-300/40 bg-rose-50/60 backdrop-blur-md dark:border-rose-400/20 dark:bg-rose-500/[0.07]',
  info: 'rounded-xl border border-indigo-300/30 bg-indigo-50/60 backdrop-blur-md dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]',
  success: 'rounded-xl border border-emerald-300/40 bg-emerald-50/60 backdrop-blur-md dark:border-emerald-400/20 dark:bg-emerald-500/[0.07]',
  amber: 'rounded-xl border border-amber-300/30 bg-amber-50/60 backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-500/[0.07]',
} as const;

export const input = 'w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';

export const select = 'w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';

export const textarea = 'w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-3 font-mono text-[13px] text-[#1e1b4b] outline-none transition-colors focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400';

export const label = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35';

export const btn = {
  primary: 'rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
  ghost: 'rounded-xl border border-indigo-200/40 bg-white/60 px-5 py-2.5 text-[14px] text-slate-600 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50 dark:hover:bg-white/[0.07]',
  danger: 'rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
} as const;

export const sectionTitle = 'text-[18px] font-medium text-[#1e1b4b] dark:text-white';
export const sectionSub = 'mt-1 text-[13px] text-slate-400 dark:text-white/40';
export const fieldLabel = 'mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35';
export const optionalBadge = 'ml-2 rounded-full border border-slate-200 bg-slate-100/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-400 dark:border-white/10 dark:bg-white/[0.04]';

// Blobs de fondo — iguales en todas las páginas
export const Blobs = () => null; // Se renderizan inline en cada página
