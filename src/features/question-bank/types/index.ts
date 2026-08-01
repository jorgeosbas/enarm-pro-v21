/**
 * Tipos de dominio del banco de preguntas.
 * Independientes de Supabase — así el parser y la UI no dependen
 * directamente del esquema de base de datos.
 */

export interface ParsedOption {
  label: string; // 'A', 'B', 'C'...
  content: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  vignette: string;
  options: ParsedOption[];
  explanation?: string;
  difficulty: 'facil' | 'media' | 'dificil';
  theme?: string; // Tema opcional, default "General" en la BD
}

export interface ParseError {
  /** Número de bloque (pregunta) donde ocurrió el problema, 1-indexado */
  blockIndex: number;
  message: string;
  /** Fragmento del texto original, para que el usuario ubique el error */
  excerpt: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: ParseError[];
}
