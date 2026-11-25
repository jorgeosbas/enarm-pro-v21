import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Fuente del logotipo de Keepler (Space Grotesk Bold). next/font la descarga al
// compilar y la sirve desde tu propio dominio; llega a KeeplerLogo.tsx por la
// variable CSS --font-space-grotesk.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Keepler',
  description: 'Preparación personal para el ENARM.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  // Metadatos que le dicen a iOS/iPadOS que, al agregar la app a la
  // pantalla de inicio, debe abrirla en modo standalone a pantalla
  // completa (sin la barra de Safari con el dominio) y con la barra de
  // estado superior integrada al color de la app.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Keepler',
  },
};

// Next.js separa "viewport" de "metadata" desde la v14. viewportFit: 'cover'
// es lo que le permite a la app dibujar detrás del notch/Dynamic Island y
// usar env(safe-area-inset-*) en el CSS (ya usado en Navigation.tsx para el
// menú inferior). maximumScale + userScalable en false evita el zoom
// accidental al tocar dos veces un botón, típico de iPadOS.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#090d16',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={spaceGrotesk.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}