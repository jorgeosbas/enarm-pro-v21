import type { ParseResult, ParsedQuestion, ParseError, ParsedOption } from '../types';

/**
 * Parser del formato de texto de ENARM Pro para importar preguntas.
 *
 * Formato esperado:
 *
 * ---
 * especialidad: Cardiología
 * dificultad: media
 * tema: Síndromes coronarios agudos
 * ---
 * P: Texto de la vignette clínica...
 * A) Opción 1
 * *C) Opción correcta (marcada con asterisco)
 * D) Opción 4
 * EXPLICACION: Texto de la explicación (opcional)
 *
 * ===
 *
 * P: Siguiente pregunta...
 * ...
 *
 * Es lógica de dominio pura: no toca la base de datos ni el DOM,
 * por eso se puede correr tanto en el cliente (vista previa instantánea)
 * como en el servidor (revalidación antes de insertar).
 */

const OPTION_LINE = /^(\*?)([A-Za-z])\)\s*(.+)$/;
const METADATA_KV = /^([a-záéíóúñ]+)\s*:\s*(.+)$/i;

function normalizeDifficulty(value: string | undefined): 'facil' | 'media' | 'dificil' {
  const v = (value ?? 'media').toLowerCase().trim();
  if (v.startsWith('fac')) return 'facil';
  if (v.startsWith('dif')) return 'dificil';
  return 'media';
}

function parseBlock(
  block: string,
  blockIndex: number,
  defaults: { difficulty: 'facil' | 'media' | 'dificil' }
): { question: ParsedQuestion | null; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const lines = block.split('\n').map((l) => l.trimEnd());

  const vignetteLines: string[] = [];
  const explanationLines: string[] = [];
  const options: ParsedOption[] = [];
  let theme: string | undefined;

  type Section = 'none' | 'vignette' | 'explanation';
  let section: Section = 'none';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    if (line.startsWith('P:')) {
      section = 'vignette';
      vignetteLines.push(line.slice(2).trim());
      continue;
    }

    const optionMatch = line.match(OPTION_LINE);
    if (optionMatch) {
      section = 'none';
      const [, star, label, content] = optionMatch;
      if (label && content) {
      options.push({ label: label.toUpperCase(), content: content.trim(), isCorrect: star === '*' });
    }
    }

    if (line.toUpperCase().startsWith('EXPLICACION:')) {
      section = 'explanation';
      explanationLines.push(line.slice(line.indexOf(':') + 1).trim());
      continue;
    }

    if (line.toUpperCase().startsWith('TEMA:')) {
      section = 'none';
      theme = line.slice(line.indexOf(':') + 1).trim();
      continue;
    }

    // Línea de continuación: se añade a la sección activa (vignette o explicación
    // pueden ocupar varias líneas en el documento de texto).
    if (section === 'vignette') vignetteLines.push(line);
    else if (section === 'explanation') explanationLines.push(line);
  }

  const vignette = vignetteLines.join(' ').trim();
  const explanation = explanationLines.join(' ').trim();
  const excerpt = block.trim().slice(0, 80).replace(/\n/g, ' ') + (block.trim().length > 80 ? '…' : '');

  if (!vignette) {
    errors.push({ blockIndex, message: 'Falta el texto de la pregunta (línea que empieza con "P:").', excerpt });
  }
  if (options.length < 2) {
    errors.push({ blockIndex, message: `Se encontraron ${options.length} opciones; se necesitan al menos 2.`, excerpt });
  }
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) {
    errors.push({ blockIndex, message: 'Ninguna opción está marcada como correcta (usa * antes de la letra, ej. "*C) ...").', excerpt });
  }
  if (correctCount > 1) {
    errors.push({ blockIndex, message: `Hay ${correctCount} opciones marcadas como correctas; solo puede haber 1.`, excerpt });
  }

  if (errors.length > 0) {
    return { question: null, errors };
  }

  return {
    question: {
      vignette,
      options,
      explanation: explanation || undefined,
      difficulty: defaults.difficulty,
      theme: theme || undefined, // undefined → BD usa default "General"
    },
    errors: [],
  };
}

export function parseQuestionsText(raw: string): ParseResult {
  // Extraer dificultad por defecto si está especificada en el texto
  const defaultDifficulty = raw.includes('dificil')
    ? 'dificil'
    : raw.includes('facil')
      ? 'facil'
      : 'media';

  const defaults = {
    difficulty: normalizeDifficulty(defaultDifficulty),
  };

  // Dividir por separador === sin importar metadatos
  const blocks = raw
    .split(/\n\s*===\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  blocks.forEach((block, i) => {
    const { question, errors: blockErrors } = parseBlock(block, i + 1, defaults);
    if (question) questions.push(question);
    errors.push(...blockErrors);
  });

  return { questions, errors };
}
