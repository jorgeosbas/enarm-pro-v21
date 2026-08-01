'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function getSession() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      setLoading(false);

      // Si no hay usuario y estamos en una ruta protegida, redirige a login
      if (!user && typeof window !== 'undefined') {
        const protectedRoutes = [
          '/dashboard',
          '/banco-preguntas',
          '/importar',
          '/perfil',
          '/estudiar',
        ];

        const currentPath = window.location.pathname;
        if (protectedRoutes.some((route) => currentPath.startsWith(route))) {
          router.push('/login');
        }
      }
    }

    getSession();
  }, [router]);

  return { user, loading };
}
