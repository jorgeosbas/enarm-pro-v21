'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LogoutButton } from './LogoutButton';
import { ThemeToggle } from './ThemeToggle';
import { AuthStatus } from './AuthStatus';
import { SearchModal } from './SearchModal';

export function Navigation() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }

    if (user) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    return undefined;
  }, [user]);

  const navItems = [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Banco', href: '/banco-preguntas' },
    { label: 'Importar', href: '/importar' },
    { label: 'Configuración', href: '/configuracion' },
  ];

  const mobileItems = [
    {
      label: 'Inicio',
      href: '/dashboard',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Flashcards',
      href: '/flashcards',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Banco',
      href: '/banco-preguntas',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
    },
    {
      label: 'Importar',
      href: '/importar',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      label: 'Perfil',
      href: '/perfil',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Header principal — glassmorphism */}
      <header
        className="sticky top-0 z-30 border-b border-indigo-300/40 bg-white/75 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0a0a14]/80"
      >
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 lg:px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-[16px] font-medium text-transparent">
              ENARM
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-white/30">Pro</span>
          </Link>

          {/* Nav links desktop */}
          {!loading && user && (
            <div className="hidden gap-5 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[13px] transition-colors ${
                    isActive(item.href)
                      ? 'font-medium text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-white/40 dark:hover:text-white/80'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Acciones derecha */}
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-indigo-300/50 bg-white/70 px-3 py-1.5 text-[12px] text-slate-500 backdrop-blur-md transition-colors hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/40 dark:hover:bg-white/[0.07]"
                title="Buscar preguntas (Ctrl+K)"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="hidden sm:inline">Buscar</span>
                <kbd className="hidden rounded border border-indigo-300/50 bg-indigo-100/70 px-1 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/30 sm:inline">
                  ⌘K
                </kbd>
              </button>
            )}
            <AuthStatus />
            <ThemeToggle />
            {user && <LogoutButton />}
          </div>
        </nav>
      </header>

      {/* Modal de búsqueda — fuera del header para z-index correcto */}
      {user && <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}

      {/* Bottom nav mobile */}
      {!loading && user && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-indigo-300/40 bg-white/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0a0a14]/90 md:hidden">
          <div className="flex items-center justify-around px-2 py-2">
            {mobileItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
                  isActive(item.href)
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-white/30'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
