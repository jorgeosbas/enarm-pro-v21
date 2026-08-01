import type { ParsedOption } from '../types';

export interface ExportableQuestion {
  specialty: string;
  topic: string | null;
  difficulty: string;
  vignette: string;
  explanation: string | null;
  options: ParsedOption[];
}

/**
 * Convierte preguntas (tal como vienen de Supabase) de vuelta al formato
 * de texto importable. Simétrico con parseQuestionsText: lo que exportas
 * aquí se puede volver a importar sin pérdida de información.
 */
export function exportQuestionsToText(questions: ExportableQuestion[]): string {
  const blocks = questions.map((q) => {
    const optionLines = q.options
      .map((o) => `${o.isCorrect ? '*' : ''}${o.label}) ${o.content}`)
      .join('\n');

    const lines = [`P: ${q.vignette}`, optionLines];
    if (q.explanation) lines.push(`EXPLICACION: ${q.explanation}`);

    return lines.join('\n');
  });

  return blocks.join('\n\n===\n\n');
}
