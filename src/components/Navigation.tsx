'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LogoutButton } from './LogoutButton';
import { ThemeToggle } from './ThemeToggle';
import { AuthStatus } from './AuthStatus';
import { SearchModal } from './SearchModal';
import { KeeplerLogo } from '@/components/KeeplerLogo';

/**
 * Ajuste fino de los márgenes del header y del menú inferior en iPhone/iPad
 * (modo "pantalla de inicio"). Se expresan sobre el "safe area" de iOS: el
 * espacio que iOS reserva para el reloj/Dynamic Island arriba y para la
 * barra del home abajo. En computadora ese espacio vale 0, así que ahí no
 * cambia nada.
 *
 *  - HEADER_TOP_EXTRA_PX: píxeles EXTRA entre la barra de estado de iOS y el
 *    contenido del header (logo y botones).
 *  - BOTTOM_NAV_SAFE_SCALE: qué fracción del espacio del home de iOS se
 *    conserva debajo del menú inferior. 1 = como antes; 0.7 = 30% menos
 *    (en iPhone ≈ 10 pt menos; en iPad ≈ 6 pt menos).
 */
const HEADER_TOP_EXTRA_PX = 4;
const BOTTOM_NAV_SAFE_SCALE = 0.7;

// min(env()*100, N px) vale N px cuando hay safe area y 0 cuando no la hay.
const HEADER_PADDING_TOP = `calc(env(safe-area-inset-top) + min(env(safe-area-inset-top) * 100, ${HEADER_TOP_EXTRA_PX}px))`;
const BOTTOM_NAV_PADDING_BOTTOM = `calc(env(safe-area-inset-bottom) * ${BOTTOM_NAV_SAFE_SCALE})`;


// Mismas 4 pestañas que el menú de escritorio — antes el menú móvil
// tenía 5 (incluía Flashcards y Perfil) y no coincidía con la versión web.
// Se define FUERA del componente: son datos estáticos, así que en vez de
// reconstruir el arreglo (y los 4 SVG) en cada render de Navigation
// (por ejemplo, cada vez que cambias de página), se crea una sola vez.
const NAV_ITEMS = [
  {
    label: 'Inicio', href: '/dashboard',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Banco', href: '/banco-preguntas',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    label: 'Importar', href: '/importar',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    label: 'Configuración', href: '/configuracion',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  const navItems = NAV_ITEMS;

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Header principal — fondo SÓLIDO (sin efecto de vidrio). Antes era
          translúcido con desenfoque (bg-white/75 + backdrop-blur), lo que dejaba
          ver y difuminar el degradado y las manchas de color de la página
          detrás, y se veía "borroso" bajo la barra de estado de iOS.
          paddingTop: env(safe-area-inset-top) dispareja del padding normal:
          con statusBarStyle 'black-translucent' (agregado en la sesión
          pasada), iOS deja que la barra de hora/batería flote ENCIMA del
          contenido en vez de empujarlo — así se ve nativo — pero eso
          significa que el header tiene que dejarle ese espacio a mano, o
          el reloj se encima con el logo (como reportaste). Es el mismo
          truco que ya usa el menú inferior con safe-area-inset-bottom. */}
      <header
        className="sticky top-0 z-30 border-b border-indigo-300/40 bg-white will-change-transform [transform:translateZ(0)] dark:border-white/[0.07] dark:bg-[#0a0a14]"
        style={{ paddingTop: HEADER_PADDING_TOP }}
      >
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 lg:px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center" aria-label="Keepler — ir al inicio">
            <KeeplerLogo size="sm" />
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            {user && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex h-8 w-8 items-center justify-center gap-2 rounded-lg border border-indigo-300/50 bg-white/70 text-[12px] text-slate-500 backdrop-blur-md transition-colors hover:bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/40 dark:hover:bg-white/[0.07] sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
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

      {/* Bottom nav mobile — se renderiza vía portal directo a <body> para escapar
          de cualquier contexto de apilamiento (z-index) creado por wrappers de cada
          página. Antes vivía dentro del árbol normal y por eso el contenido de las
          páginas a veces pintaba ENCIMA del menú, dejándolo inutilizable. */}
      {mounted && !loading && user && createPortal(
        <nav
          className="fixed bottom-0 left-0 right-0 z-[9500] border-t border-indigo-300/40 bg-white will-change-transform [transform:translateZ(0)] dark:border-white/[0.07] dark:bg-[#0a0a14] md:hidden"
          style={{ paddingBottom: BOTTOM_NAV_PADDING_BOTTOM }}
        >
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map((item) => (
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
        </nav>,
        document.body
      )}
    </>
  );
}