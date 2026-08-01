/**
 * Entrenamiento Inteligente — Algoritmo de Priority Score
 *
 * IMPORTANTE: Este módulo es de SOLO LECTURA respecto a Flashcards.
 * Lee datos de FSRS pero jamás los escribe ni los modifica.
 * Toda la lógica vive aquí, dentro de features/training.
 * No importa ni toca ningún archivo de features/flashcards.
 */

// ─────────────────────────────────────────────
// Tipos de entrada
// ─────────────────────────────────────────────

export interface QuestionForScoring {
  id: string;
  theme_id: string | null;
  importance: number; // 1–5, campo en BD
}

/**
 * Datos de FSRS leídos de user_flashcard_progress.
 * Solo lectura — nunca se escribe de vuelta.
 */
export interface FSRSReadonlyData {
  question_id: string;
  stability: number;
  reps: number;
  last_review: string | null; // ISO string o null
  due_date: string;           // ISO string
}

/** Estadísticas del usuario para un tema dado */
export interface ThemeStats {
  theme_id: string;
  total_attempts: number;
  correct_attempts: number;
}

/** Último intento del usuario en una pregunta */
export interface LastAttempt {
  question_id: string;
  answered_at: string; // ISO string
}

/** Datos completos necesarios para calcular el score de una pregunta */
export interface ScoringInput {
  question: QuestionForScoring;
  fsrsData: FSRSReadonlyData | null;     // null si la pregunta no tiene progreso FSRS
  themeStats: ThemeStats | null;         // null si no hay historial para ese tema
  lastAttempt: LastAttempt | null;       // null si nunca se respondió
}

// ─────────────────────────────────────────────
// Pesos del algoritmo (configurables aquí)
// ─────────────────────────────────────────────

const WEIGHTS = {
  fsrs: 0.40,        // 40% — Retrievability FSRS (qué tan probable es que lo olvide)
  theme: 0.30,       // 30% — Rendimiento del usuario en el tema
  importance: 0.20,  // 20% — Importancia ENARM (1–5)
  recency: 0.10,     // 10% — Tiempo desde el último intento
} as const;

// ─────────────────────────────────────────────
// Helpers de normalización
// Todos devuelven un valor en [0, 1] donde 1 = máxima prioridad
// ─────────────────────────────────────────────

/**
 * Calcula la retrievability estimada de FSRS.
 * Fórmula simplificada: R = e^(-t / S)
 *   t = días desde último repaso
 *   S = estabilidad
 *
 * Retorna prioridad ALTA cuando R es BAJA (el usuario está a punto de olvidarlo).
 * Si no hay dato FSRS, asume prioridad alta (pregunta nunca vista → alta urgencia).
 */
function normalizeFSRS(fsrsData: FSRSReadonlyData | null): number {
  if (!fsrsData || !fsrsData.last_review) {
    // Sin historial FSRS → prioridad máxima (nunca revisada)
    return 1.0;
  }

  const stability = Math.max(fsrsData.stability, 0.1); // evitar división por 0
  const lastReviewDate = new Date(fsrsData.last_review);
  const daysSinceReview =
    (Date.now() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);

  // Retrievability estimada con fórmula FSRS (solo lectura, no toca el algoritmo)
  const retrievability = Math.exp(-daysSinceReview / stability);

  // Invertir: baja retrievability = alta prioridad
  return 1 - Math.max(0, Math.min(1, retrievability));
}

/**
 * Normaliza el rendimiento del usuario en el tema.
 * Baja tasa de aciertos → alta prioridad.
 * Sin historial → prioridad media-alta (0.65, favor al desconocido).
 */
function normalizeTheme(themeStats: ThemeStats | null): number {
  if (!themeStats || themeStats.total_attempts === 0) {
    return 0.65; // Sin dato: prioridad media-alta (prefer unknown)
  }

  const accuracy = themeStats.correct_attempts / themeStats.total_attempts;

  // Invertir: peor rendimiento = más prioridad
  return 1 - Math.max(0, Math.min(1, accuracy));
}

/**
 * Normaliza la importancia ENARM (1–5).
 * Mayor importancia → mayor prioridad.
 * Mapea el rango [1, 5] a [0, 1].
 */
function normalizeImportance(importance: number): number {
  const clamped = Math.max(1, Math.min(5, importance));
  return (clamped - 1) / 4; // 1→0.0, 3→0.5, 5→1.0
}

/**
 * Normaliza el tiempo desde el último intento en el modo Quiz.
 * Más tiempo = mayor prioridad. Satura en 90 días (escala log).
 * Sin intento previo → prioridad máxima.
 */
function normalizeRecency(lastAttempt: LastAttempt | null): number {
  if (!lastAttempt) {
    return 1.0; // Nunca respondida → máxima prioridad
  }

  const lastDate = new Date(lastAttempt.answered_at);
  const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  // Escala logarítmica: satura a los ~90 días
  const MAX_DAYS = 90;
  const normalized = Math.log1p(daysSince) / Math.log1p(MAX_DAYS);

  return Math.max(0, Math.min(1, normalized));
}

// ─────────────────────────────────────────────
// Función principal pública
// ─────────────────────────────────────────────

export interface PriorityScoreResult {
  question_id: string;
  score: number;         // 0–1, donde 1 es máxima prioridad
  breakdown: {
    fsrs: number;        // componente FSRS normalizado
    theme: number;       // componente de tema normalizado
    importance: number;  // componente de importancia normalizado
    recency: number;     // componente de recencia normalizado
  };
}

/**
 * Calcula el Priority Score de una pregunta para el modo Entrenamiento Inteligente.
 *
 * Este score determina ÚNICAMENTE qué preguntas se muestran en este modo.
 * No afecta Flashcards, Simulador ni ningún otro módulo.
 *
 * @param input - Datos de la pregunta, FSRS (solo lectura), tema y último intento
 * @returns Score entre 0 y 1, más un breakdown para debugging
 */
export function calculatePriorityScore(input: ScoringInput): PriorityScoreResult {
  const { question, fsrsData, themeStats, lastAttempt } = input;

  // Normalizar cada componente a [0, 1]
  const fsrsScore       = normalizeFSRS(fsrsData);
  const themeScore      = normalizeTheme(themeStats);
  const importanceScore = normalizeImportance(question.importance);
  const recencyScore    = normalizeRecency(lastAttempt);

  // Suma ponderada según los pesos definidos arriba
  const score =
    WEIGHTS.fsrs       * fsrsScore +
    WEIGHTS.theme      * themeScore +
    WEIGHTS.importance * importanceScore +
    WEIGHTS.recency    * recencyScore;

  return {
    question_id: question.id,
    score: Math.max(0, Math.min(1, score)),
    breakdown: {
      fsrs:       fsrsScore,
      theme:      themeScore,
      importance: importanceScore,
      recency:    recencyScore,
    },
  };
}

// ─────────────────────────────────────────────
// Selección final de preguntas para la sesión
// ─────────────────────────────────────────────

export interface ScoredQuestion<T> {
  question: T;
  score: number;
}

/**
 * Ordena preguntas por Priority Score y selecciona las primeras N.
 * Aplica una mezcla leve al final para que no siempre aparezcan en el mismo orden.
 *
 * @param questions - Lista de preguntas con sus datos de scoring
 * @param count     - Cuántas preguntas seleccionar
 * @returns Subconjunto priorizado y ligeramente mezclado
 */
export function selectTrainingQuestions<T extends QuestionForScoring>(
  questions: Array<{
    question: T;
    fsrsData: FSRSReadonlyData | null;
    themeStats: ThemeStats | null;
    lastAttempt: LastAttempt | null;
  }>,
  count: number
): T[] {
  if (questions.length === 0) return [];

  // 1. Calcular score para cada pregunta
  const scored: ScoredQuestion<T>[] = questions.map(({ question, fsrsData, themeStats, lastAttempt }) => ({
    question,
    score: calculatePriorityScore({ question, fsrsData, themeStats, lastAttempt }).score,
  }));

  // 2. Ordenar de mayor a menor prioridad
  scored.sort((a, b) => b.score - a.score);

  // 3. Tomar las primeras N (el doble del solicitado, con mínimo de count)
  //    para luego mezclarlas levemente
  const poolSize = Math.min(scored.length, Math.max(count, Math.floor(count * 1.5)));
  const topPool = scored.slice(0, poolSize);

  // 4. Mezcla leve del pool (Fisher-Yates sobre el top pool)
  // 4. Mezcla leve del pool (Fisher-Yates sobre el top pool)
  for (let i = topPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = topPool[i];
    topPool[i] = topPool[j]!;
    topPool[j] = temp!;
  }

  // 5. Devolver exactamente count preguntas
  return topPool.slice(0, count).map((s) => s.question);
}
