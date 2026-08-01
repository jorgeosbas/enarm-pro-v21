'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/features/question-bank/hooks/useUserProfile';

export function AuthStatus() {
  const { user, loading } = useAuth();
  const { data: profile } = useUserProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || loading) {
    return <div className="h-8 w-8 animate-pulse rounded-lg bg-indigo-100/50 dark:bg-white/[0.05] sm:w-28" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-indigo-300/50 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-indigo-600 backdrop-blur-md transition-colors hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-indigo-400 dark:hover:bg-white/[0.07] sm:px-4"
      >
        Iniciar sesión
      </Link>
    );
  }

  const hasName = profile?.full_name && profile.full_name.trim().length > 0;
  let prefix = '';
  if (hasName) {
    if (profile?.gender === 'M') prefix = 'Dr. ';
    else if (profile?.gender === 'F') prefix = 'Dra. ';
  }
  const displayName = hasName ? `${prefix}${profile!.full_name}` : 'Perfil';
  const initial = hasName ? (profile!.full_name?.charAt(0) ?? 'U').toUpperCase() : 'P';

  return (
    <Link
      href="/perfil"
      title="Ir a perfil"
      className="flex h-8 w-8 items-center justify-center gap-2 rounded-lg border border-indigo-300/50 bg-white/70 backdrop-blur-md transition-colors hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07] sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
    >
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[11px] font-bold text-white">
        {initial}
      </div>
      {/* En móvil solo se ve el avatar — el nombre completo saturaba el header.
          A partir de sm: (≥640px) reaparece, igual que el texto "Buscar". */}
      <span className="hidden text-[13px] font-medium text-[#1e1b4b] dark:text-white/75 sm:inline">
        {displayName}
      </span>
    </Link>
  );
}
