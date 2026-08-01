'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

  // Colchón extra debajo de cada página en móvil, para que el contenido nunca
  // quede pegado al menú inferior fijo — independiente del padding que ya
  // traiga cada <main>. En escritorio no hay menú inferior, así que no aplica.
  return <div className="pb-8 md:pb-0">{children}</div>;
}
