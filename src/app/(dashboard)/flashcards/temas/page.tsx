'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LoadingScreen } from '@/components/LoadingScreen';
import { createClient } from '@/lib/supabase/client';

interface ThemeItem {
  id: string;
  name: string;
  questionCount: number;
}
interface SubcategoryGroup {
  id: string;
  name: string;
  themes: ThemeItem[];
}
interface SpecialtyGroup {
  id: string;
  name: string;
  subcategories: SubcategoryGroup[];
}

const PAGE_SIZE = 1000;

/** Lee TODAS las filas paginando de 1000 en 1000. */
async function fetchAll(
  build: (from: number, to: number) => PromiseLike<any>
): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page: any[] = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

export default function FlashcardsTemasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<SpecialtyGroup[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const db = supabase as unknown as SupabaseClient;

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const themeRows = await fetchAll((from, to) =>
        db
          .from('themes')
          .select('id, name, subcategory:subcategories(id, name, specialty:specialties(id, name))')
          .order('id', { ascending: true })
          .range(from, to)
      );

      const questionRows = await fetchAll((from, to) =>
        db
          .from('questions')
          .select('id, theme_id')
          .order('id', { ascending: true })
          .range(from, to)
      );

      const counts = new Map<string, number>();
      let untagged = 0;
      for (const q of questionRows) {
        if (q.theme_id) {
          const key = String(q.theme_id);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        } else {
          untagged++;
        }
      }

      const activeRows = await fetchAll((from, to) =>
        db
          .from('user_active_themes')
          .select('theme_id')
          .eq('user_id', user.id)
          .order('theme_id', { ascending: true })
          .range(from, to)
      );
      setActiveIds(new Set(activeRows.map((r) => String(r.theme_id))));
      setUntaggedCount(untagged);

      // Agrupar: especialidad > subcategoría > tema.
      // Solo temas que tienen preguntas (un tema vacío no tiene nada que estudiar).
      const specialtyMap = new Map<string, SpecialtyGroup>();
      for (const t of themeRows) {
        const sub = t.subcategory;
        const spec = sub?.specialty;
        const questionCount = counts.get(String(t.id)) ?? 0;
        if (!sub || !spec || questionCount === 0) continue;

        let sg = specialtyMap.get(spec.id);
        if (!sg) {
          sg = { id: spec.id, name: spec.name, subcategories: [] };
          specialtyMap.set(spec.id, sg);
        }
        let sbg = sg.subcategories.find((s) => s.id === sub.id);
        if (!sbg) {
          sbg = { id: sub.id, name: sub.name, themes: [] };
          sg.subcategories.push(sbg);
        }
        sbg.themes.push({ id: String(t.id), name: t.name, questionCount });
      }

      const sorted = Array.from(specialtyMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      sorted.forEach((sg) => {
        sg.subcategories.sort((a, b) => a.name.localeCompare(b.name));
        sg.subcategories.forEach((s) =>
          s.themes.sort((a, b) => a.name.localeCompare(b.name))
        );
      });
      setGroups(sorted);
    } catch (err) {
      console.error('[flashcards/temas] Error al cargar temas:', err);
      setErrorMsg('No se pudieron cargar los temas. Recarga la página.');
    } finally {
      setLoading(false);
    }
  }

  function toggleTheme(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleActivate() {
    if (!userId || selected.size === 0 || saving) return;

    const count = selected.size;
    const plural = count !== 1 ? 's' : '';
    const ok = window.confirm(
      `Vas a activar ${count} tema${plural}.\n\n` +
        'Una vez activado, un tema NO se puede desactivar.\n' +
        'Se agregarán hasta 40 tarjetas nuevas al día por estos temas.\n\n' +
        '¿Continuar?'
    );
    if (!ok) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const supabase = createClient();
      const db = supabase as unknown as SupabaseClient;
      const chosen = Array.from(selected);
      const rows = chosen.map((theme_id) => ({ user_id: userId, theme_id }));

      const { error } = await db
        .from('user_active_themes')
        .upsert(rows, { onConflict: 'user_id,theme_id', ignoreDuplicates: true });
      if (error) throw error;

      setActiveIds((prev) => new Set([...Array.from(prev), ...chosen]));
      setSelected(new Set());
      setSuccessMsg(`Listo: ${count} tema${plural} activado${plural}.`);
    } catch (err) {
      console.error('[flashcards/temas] Error al activar temas:', err);
      setErrorMsg('No se pudieron activar los temas. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // Estados de carga y error
  // ==========================================
  if (loading) {
    return <LoadingScreen message="Cargando tus temas..." />;
  }

  const totalThemes = groups.reduce(
    (n, sg) => n + sg.subcategories.reduce((m, s) => m + s.themes.length, 0),
    0
  );
  const activeInCatalog = groups.reduce(
    (n, sg) =>
      n +
      sg.subcategories.reduce(
        (m, s) => m + s.themes.filter((t) => activeIds.has(t.id)).length,
        0
      ),
    0
  );

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-32 pt-8 lg:px-6">
        <button
          onClick={() => router.push('/flashcards')}
          className="mb-5 rounded-xl border border-indigo-300/50 bg-white/65 px-4 py-2 text-[13px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50"
        >
          ← Flashcards
        </button>

        <h1 className="mb-2 text-[20px] font-medium text-[#1e1b4b] dark:text-white">
          Temas de Flashcards
        </h1>
        <p className="mb-2 text-[13px] text-slate-600 dark:text-white/50">
          Activa los temas que ya estudiaste. Solo aparecerán flashcards de temas activos.
        </p>
        <p className="mb-6 text-[12px] text-amber-700 dark:text-amber-300/80">
          Un tema activado no se puede desactivar.
        </p>

        <div className="mb-6 rounded-xl border border-indigo-300/40 bg-white/60 px-4 py-3 text-[13px] text-[#1e1b4b] backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/80">
          Activos: {activeInCatalog} de {totalThemes} temas
        </div>

        {untaggedCount > 0 && (
          <div className="mb-6 rounded-xl border border-slate-300/50 bg-white/50 px-4 py-3 text-[12px] text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40">
            Hay {untaggedCount} preguntas sin tema asignado. No aparecen en Flashcards hasta que tengan tema.
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-xl border border-emerald-300/50 bg-emerald-100/55 px-4 py-3 text-[13px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 rounded-xl border border-rose-300/50 bg-rose-100/55 px-4 py-3 text-[13px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {groups.length === 0 && (
          <div className="rounded-xl border border-slate-300/50 bg-white/50 p-6 text-center text-[13px] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40">
            No hay temas con preguntas todavía.
          </div>
        )}

        {groups.map((sg) => (
          <section key={sg.id} className="mb-8">
            <h2 className="mb-3 text-[15px] font-medium text-[#1e1b4b] dark:text-white/90">
              {sg.name}
            </h2>

            {sg.subcategories.map((sub) => (
              <div key={sub.id} className="mb-4">
                <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-slate-500 dark:text-white/35">
                  {sub.name}
                </h3>

                <ul className="space-y-2">
                  {sub.themes.map((theme) => {
                    const isActive = activeIds.has(theme.id);
                    const isSelected = selected.has(theme.id);

                    if (isActive) {
                      return (
                        <li
                          key={theme.id}
                          className="flex items-center justify-between rounded-xl border border-emerald-300/50 bg-emerald-100/40 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-500/[0.06]"
                        >
                          <span className="text-[13px] text-[#1e1b4b] dark:text-white/80">
                            {theme.name}
                          </span>
                          <span className="text-[12px] text-emerald-700 dark:text-emerald-300">
                            🔒 Activo · {theme.questionCount} preguntas
                          </span>
                        </li>
                      );
                    }

                    return (
                      <li key={theme.id}>
                        <label
                          className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 backdrop-blur-md transition-colors ${
                            isSelected
                              ? 'border-indigo-400/70 bg-indigo-100/70 dark:border-indigo-400/40 dark:bg-indigo-500/15'
                              : 'border-indigo-300/40 bg-white/60 hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={saving}
                              onChange={() => toggleTheme(theme.id)}
                              className="h-4 w-4 accent-indigo-500"
                            />
                            <span className="text-[13px] text-[#1e1b4b] dark:text-white/80">
                              {theme.name}
                            </span>
                          </div>
                          <span className="text-[12px] text-slate-500 dark:text-white/35">
                            {theme.questionCount} preguntas
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </main>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-20 px-4 md:bottom-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-indigo-300/50 bg-white/90 px-5 py-3 shadow-lg backdrop-blur-md dark:border-white/[0.1] dark:bg-[#14142a]/95">
            <span className="text-[13px] text-[#1e1b4b] dark:text-white/80">
              {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleActivate}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Activando...' : `Activar ${selected.size} tema${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
