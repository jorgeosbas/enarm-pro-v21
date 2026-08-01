'use client';

import { Navigation } from '@/components/Navigation';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div
        className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18"
        style={{ filter: 'blur(90px)' }}
      />
      <div
        className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14"
        style={{ filter: 'blur(80px)' }}
      />

      <div className="relative z-10"><Navigation /></div>

      <div className="relative z-10 flex min-h-[calc(100vh-60px)] flex-col items-center justify-center px-4">
        {/* Anillo pulsante */}
        <div className="mb-8 animate-scale-in">
          <div className="relative h-14 w-14">
            <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/25 dark:bg-indigo-400/15" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="animate-slide-up rounded-2xl border border-indigo-300/50 bg-white/70 px-8 py-5 text-center backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04]">
          <p className="mb-4 text-[14px] font-medium text-[#1e1b4b] dark:text-white/80">{message}</p>
          <div className="flex items-center justify-center gap-2">
            <span className="dot-1 h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-500" />
            <span className="dot-2 h-2 w-2 rounded-full bg-purple-400 dark:bg-purple-500" />
            <span className="dot-3 h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
