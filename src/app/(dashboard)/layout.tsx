'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Navigation } from '@/components/Navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // No hay usuario, redirige a login
        router.push('/login');
        return;
      }

      // Hay usuario, permite acceso
      setIsAuthorized(true);
      setIsLoading(false);
    }

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-neutral-600 dark:text-neutral-400">Cargando...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // El useEffect ya redirigió a login
  }

  // Navigation vive aquí, en el layout compartido de (dashboard) — NO dentro
  // de cada page.tsx. Un layout de Next.js persiste entre navegaciones a
  // páginas hermanas (banco-preguntas → importar → dashboard, etc.); solo
  // "children" se reemplaza. Antes cada página montaba su propia
  // <Navigation />, así que en cada cambio de pantalla el menú se destruía
  // y se volvía a crear desde cero — eso era el "parpadeo"/glitch que
  // reportaste, tanto en el header de escritorio como en el menú inferior
  // móvil. Con Navigation aquí, es un solo componente que nunca se
  // desmonta mientras navegas dentro de la app.
  return (
    <>
      <Navigation />
      <div className="pb-8 md:pb-0">{children}</div>
    </>
  );
}