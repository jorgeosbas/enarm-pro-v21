import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Rutas protegidas que REQUIEREN autenticación
  const protectedPaths = [
    '/dashboard',
    '/banco-preguntas',
    '/importar',
    '/perfil',
    '/estudiar',
    '/exportar',
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Si es ruta protegida, actualiza sesión (refresca token si es necesario)
  if (isProtectedPath) {
    return await updateSession(request);
  }

  // Para rutas públicas (login, etc.), solo refresca sesión silenciosamente
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
