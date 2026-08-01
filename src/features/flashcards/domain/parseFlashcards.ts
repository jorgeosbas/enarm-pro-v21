export interface ParsedFlashcard {
  front: string;
  back: string;
}

export interface FlashcardParseError {
  lineNumber: number;
  message: string;
  excerpt: string;
}

export interface FlashcardParseResult {
  cards: ParsedFlashcard[];
  errors: FlashcardParseError[];
}

/**
 * Formato: una tarjeta por línea, "pregunta | respuesta".
 * Líneas vacías o que empiezan con "#" (comentarios) se ignoran.
 * Compatible con exports simples de Anki (delimitador "|").
 */
export function parseFlashcardsText(raw: string): FlashcardParseResult {
  const cards: ParsedFlashcard[] = [];
  const errors: FlashcardParseError[] = [];

  const lines = raw.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;

    const parts = trimmed.split('|');
    if (parts.length < 2) {
      errors.push({
        lineNumber: i + 1,
        message: 'Falta el separador "|" entre pregunta y respuesta.',
        excerpt: trimmed.slice(0, 60),
      });
      return;
    }

    if (!parts[0]) return;
    const front = parts[0].trim();
    const back = parts.slice(1).join('|').trim(); // permite "|" dentro de la respuesta

    if (!front || !back) {
      errors.push({
        lineNumber: i + 1,
        message: 'La pregunta o la respuesta están vacías.',
        excerpt: trimmed.slice(0, 60),
      });
      return;
    }

    cards.push({ front, back });
  });

  return { cards, errors };
}

export function exportFlashcardsToText(cards: ParsedFlashcard[]): string {
  return cards.map((c) => `${c.front} | ${c.back}`).join('\n');
}