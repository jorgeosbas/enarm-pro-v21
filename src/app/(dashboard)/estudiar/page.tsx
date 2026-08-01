'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSpecialties } from '@/features/question-bank/hooks/useSpecialties';
import { useSubcategoriesBySpecialty } from '@/features/question-bank/hooks/useSubcategories';
import { useThemesBySubcategory } from '@/features/question-bank/hooks/useThemesBySubcategory';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';

export default function EstudiarPage() {
  const router = useRouter();
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [startingStudy, setStartingStudy] = useState(false);

  const { data: specialties } = useSpecialties();
  const { data: subcategories } = useSubcategoriesBySpecialty(selectedSpecialty || null);
  const { data: themes } = useThemesBySubcategory(selectedSubcategory || null);

  const specialtiesList = (specialties as any[]) || [];
  const subcategoriesList = (subcategories as any[]) || [];
  const themesList = (themes as any[]) || [];

  function handleStart() {
    if (!selectedSpecialty) {
      alert('Debes seleccionar una especialidad');
      return;
    }

    setStartingStudy(true);

    // Construir la ruta según lo que seleccionó
    let route = '/estudiar-flexible?';
    route += `specialty=${selectedSpecialty}`;
    
    if (selectedSubcategory) {
      route += `&subcategory=${selectedSubcategory}`;
    }
    if (selectedTheme) {
      route += `&theme=${selectedTheme}`;
    }

    router.push(route);
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Navigation />

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold">Estudiar por tema</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Selecciona especialidad, subcategoría y tema (opcional) para comenzar.
          </p>
        </div>

        {/* Formulario */}
        <div className="space-y-6 rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
          {/* Especialidad */}
          <div>
            <label className="mb-2 block text-sm font-medium">Especialidad *</label>
            <select
              value={selectedSpecialty}
              onChange={(e) => {
                setSelectedSpecialty(e.target.value);
                setSelectedSubcategory('');
                setSelectedTheme('');
              }}
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">Selecciona una especialidad...</option>
              {specialtiesList.map((spec: any) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategoría (opcional) */}
          <div>
            <label className="mb-2 block text-sm font-medium">Subcategoría (Opcional)</label>
            {!selectedSpecialty ? (
              <div className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                Selecciona especialidad primero
              </div>
            ) : (
              <select
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setSelectedTheme('');
                }}
                className="w-full rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="">Selecciona una subcategoría...</option>
                {subcategoriesList.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tema (opcional) */}
          <div>
            <label className="mb-2 block text-sm font-medium">Tema (Opcional)</label>
            {!selectedSubcategory ? (
              <div className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                Selecciona subcategoría primero
              </div>
            ) : (
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="">
                  Todos los temas de {subcategoriesList.find((s: any) => s.id === selectedSubcategory)?.name}
                </option>
                {themesList.map((theme: any) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Botón de inicio */}
          <Button
            onClick={handleStart}
            disabled={!selectedSubcategory || startingStudy}
            className="w-full py-3"
          >
            {startingStudy ? 'Iniciando...' : '▶️ Comenzar a estudiar'}
          </Button>
        </div>

        {/* Información */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-100 p-6 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong>💡 Tip:</strong> Selecciona solo especialidad para estudiar todo, o añade subcategoría/tema para ser más específico.
          </p>
        </div>
      </main>
    </div>
  );
}