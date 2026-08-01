import React from 'react';

interface CustomSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

/**
 * CustomSelect — select nativo con diseño glassmorphism consistente con la app.
 * Reemplaza cualquier <select> nativo. Acepta todas las props nativas de <select>.
 *
 * Uso:
 *   <CustomSelect value={val} onChange={e => setVal(e.target.value)}>
 *     <option value="">Selecciona...</option>
 *     <option value="1">Opción 1</option>
 *   </CustomSelect>
 */
export const CustomSelect = React.forwardRef<HTMLSelectElement, CustomSelectProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={[
            // Reset nativo
            'appearance-none',
            // Layout
            'w-full',
            // Espaciado — espacio derecho para el chevron
            'py-2.5 pl-4 pr-10',
            // Tipografía
            'text-[13px]',
            // Colores modo claro
            'bg-white/75 text-[#1e1b4b]',
            // Borde modo claro
            'border border-indigo-300/50',
            // Colores modo oscuro
            'dark:bg-white/[0.05] dark:text-white/85',
            'dark:border-white/[0.08]',
            // Forma
            'rounded-xl',
            // Focus
            'outline-none focus:border-indigo-400 dark:focus:border-indigo-400',
            // Transición
            'transition-colors',
            // Cursor
            'cursor-pointer',
            // Disabled
            'disabled:cursor-not-allowed disabled:opacity-40',
            className,
          ].join(' ')}
          {...props}
        >
          {children}
        </select>

        {/* Chevron — pointer-events-none para no bloquear clicks */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/30">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    );
  }
);

CustomSelect.displayName = 'CustomSelect';
