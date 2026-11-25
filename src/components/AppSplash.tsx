'use client';

import { useState, useEffect } from 'react';
import { KeeplerMark, KeeplerWordmark } from '@/components/KeeplerLogo';

/**
 * AppSplash — loader que aparece al abrir la app por primera vez.
 * Se oculta automáticamente cuando React termina de hidratar.
 * No usa Navigation ni hooks de datos — es puro CSS.
 */
export function AppSplash({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Pequeño delay para que la transición se vea
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Splash */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#e9e3fb] dark:bg-[#0a0a14] transition-opacity duration-500 ${
          ready ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        {/* Blobs */}
        <div
          className="pointer-events-none absolute left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18"
          style={{ filter: 'blur(90px)' }}
        />
        <div
          className="pointer-events-none absolute right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14"
          style={{ filter: 'blur(80px)' }}
        />
        <div
          className="pointer-events-none absolute bottom-[20px] left-[160px] h-[220px] w-[220px] rounded-full bg-cyan-400/12 dark:bg-cyan-400/10"
          style={{ filter: 'blur(70px)' }}
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo animado */}
          <div className="mb-6 animate-scale-in">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/20 dark:bg-indigo-400/15" />
              <KeeplerMark height={44} className="relative" />
            </div>
          </div>

          {/* Wordmark */}
          <div className="animate-slide-up mb-6">
            <KeeplerWordmark className="text-[28px]" />
          </div>

          {/* Dots */}
          <div className="animate-fade-in flex items-center gap-2" style={{ animationDelay: '0.15s' }}>
            <span className="dot-1 h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-500" />
            <span className="dot-2 h-2 w-2 rounded-full bg-purple-400 dark:bg-purple-500" />
            <span className="dot-3 h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-500" />
          </div>
        </div>
      </div>

      {/* Contenido real — visible siempre pero oculto hasta que splash se va */}
      <div className={`transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}>
        {children}
      </div>
    </>
  );
}