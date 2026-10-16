/**
 * Ayudantes para leer de Supabase SIN toparse con sus límites.
 *
 * Por qué existe: Supabase devuelve como máximo 1000 filas por consulta y,
 * si pasa de ahí, corta en silencio (no da error). Antes, varias pantallas
 * pedían las opciones de TODO el banco en una sola consulta: al pasar de
 * ~1000 opciones (unas 200-250 preguntas), a las preguntas que quedaban
 * fuera del corte les llegaban cero opciones y se veían sin respuestas.
 *
 * Además, mandar cientos de ids en una sola consulta `.in(...)` genera una
 * dirección web enorme que también acaba fallando al crecer el banco.
 */
import type { createClient } from '@/lib/supabase/client';

type SupabaseBrowserClient = ReturnType<typeof createClient>;

/** Filas máximas que Supabase devuelve por consulta. */
export const PAGE_SIZE = 1000;
/** Ids máximos por consulta `.in(...)`. */
export const IN_CHUNK_SIZE = 100;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Lee TODAS las filas de una consulta, pidiéndolas de 1000 en 1000.
 *
 * `build(from, to)` debe devolver la consulta con `.range(from, to)` y un
 * orden estable (si no, las páginas pueden repetir o saltarse filas).
 */
export async function fetchAllPages<T = any>(
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

export interface QuestionOptionRow {
  id: string;
  question_id: string;
  label: string;
  content: string;
  is_correct: boolean;
}

/**
 * Trae las opciones de las preguntas indicadas, en grupos de 100 ids y
 * paginando por si algún grupo pasara de 1000 filas.
 */
export async function fetchOptionsByQuestionIds(
  supabase: SupabaseBrowserClient,
  questionIds: string[]
): Promise<QuestionOptionRow[]> {
  const groups = await Promise.all(
    chunkArray(questionIds, IN_CHUNK_SIZE).map((ids) =>
      fetchAllPages<QuestionOptionRow>((from, to) =>
        supabase
          .from('question_options')
          .select('id, question_id, label, content, is_correct')
          .in('question_id', ids)
          .order('id', { ascending: true })
          .range(from, to)
      )
    )
  );
  return groups.flat();
}

/** Agrupa las opciones por pregunta, ordenadas por letra (A, B, C…). */
export function groupOptionsByQuestion(
  options: QuestionOptionRow[]
): Map<string, QuestionOptionRow[]> {
  const byQuestion = new Map<string, QuestionOptionRow[]>();
  for (const option of options) {
    const list = byQuestion.get(option.question_id);
    if (list) list.push(option);
    else byQuestion.set(option.question_id, [option]);
  }
  for (const list of byQuestion.values()) {
    list.sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? '')));
  }
  return byQuestion;
}
