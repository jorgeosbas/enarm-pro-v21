import Image from 'next/image';

/**
 * Identidad de marca de Keepler.
 *
 *  - Marca (ícono): el ícono Aurora que ya usa la app como ícono de iOS
 *    (public/icons/icon-192.png). Para cambiarlo, basta con editar
 *    KEEPLER_MARK_SRC.
 *  - Logotipo: "Keepler" en Space Grotesk Bold (la fuente se carga en
 *    src/app/layout.tsx y llega aquí por la variable --font-space-grotesk).
 *    Color crema en modo oscuro y índigo profundo en modo claro.
 */
const KEEPLER_MARK_SRC = '/icons/icon-192.png';

const WORDMARK_FONT = 'var(--font-space-grotesk), system-ui, sans-serif';

const WORDMARK_COLOR = 'text-[#1e1b4b] dark:text-[#f2e9d8]';

/** Solo el ícono, cuadrado con esquinas suaves. */
export function KeeplerMark({
  size = 28,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={KEEPLER_MARK_SRC}
      alt=""
      width={size}
      height={size}
      // unoptimized: se sirve el archivo tal cual (ya es pequeño), sin
      // depender del optimizador de imágenes de Next.
      unoptimized
      priority
      className={`flex-shrink-0 rounded-[22%] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Solo la palabra "Keepler". `className` controla el tamaño de letra. */
export function KeeplerWordmark({ className = 'text-[20px]' }: { className?: string }) {
  return (
    <span
      className={`font-bold leading-none tracking-tight ${WORDMARK_COLOR} ${className}`}
      style={{ fontFamily: WORDMARK_FONT }}
    >
      Keepler
    </span>
  );
}

/** Ícono + logotipo. `stacked` los pone uno encima del otro (login, splash). */
export function KeeplerLogo({
  size = 'sm',
  stacked = false,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  stacked?: boolean;
  className?: string;
}) {
  const config = {
    sm: { icon: 28, text: 'text-[20px]' },
    md: { icon: 44, text: 'text-[26px]' },
    lg: { icon: 72, text: 'text-[34px]' },
  }[size];

  return (
    <span
      className={`inline-flex ${stacked ? 'flex-col items-center gap-3.5' : 'items-center gap-2.5'} ${className}`}
    >
      <KeeplerMark size={config.icon} className="shadow-md shadow-indigo-500/20" />
      <KeeplerWordmark className={config.text} />
    </span>
  );
}
