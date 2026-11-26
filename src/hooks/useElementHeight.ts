import { useLayoutEffect, useEffect, useState, type RefObject } from 'react';

// useLayoutEffect solo existe en el navegador; en el servidor se usa useEffect
// para no generar avisos.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Altura actual (en px) de un elemento, que se actualiza sola si cambia.
 * Devuelve null hasta que se haya medido (primer render / servidor).
 *
 * Se usa para el espacio que reserva el header, que ahora es una barra
 * fija (position: fixed) y por eso ya no ocupa lugar en el flujo de la página.
 */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}
