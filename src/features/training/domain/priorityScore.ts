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
  /**
   * ISO string de la última vez que el usuario respondió CUALQUIER pregunta
   * de este tema (en cualquier modo). Null si nunca. Se usa solo para el
   * cooldown de 24h. Opcional para no romper llamadas existentes.
   */
  themeLastPracticed?: string | null;
  /**
   * Valor ya calculado para el componente FSRS. Lo usa selectTrainingQuestions
   * cuando detecta saturación por inactividad y necesita sustituir el valor
   * absoluto por uno relativo (ranking). Si no se pasa, se calcula normal.
   */
  fsrsOverride?: number;
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

/**
 * Score asignado a una pregunta sin historial (nunca vista / nunca respondida).
 * Alto —queremos que las preguntas nuevas entren pronto— pero NO máximo,
 * para que no desplacen automáticamente a las preguntas débiles ya vistas.
 */
const COLD_START_SCORE = 0.75;

/**
 * Reentrada tras inactividad.
 * Si la mediana de urgencia FSRS del banco supera este umbral, significa que
 * prácticamente TODO está vencido (típico al volver tras días o semanas sin
 * estudiar). En ese estado la fórmula absoluta pierde poder de discriminación
 * porque todo se satura cerca de 1.0, así que se cambia a ranking relativo.
 */
const SATURATION_THRESHOLD = 0.90;

/**
 * Cooldown por tema: si un tema ya se practicó dentro de las últimas
 * COOLDOWN_HOURS horas, su score se multiplica por COOLDOWN_FACTOR.
 * Evita la "espiral de la muerte": que un tema débil te persiga sesión
 * tras sesión sin dejar subir a los demás.
 */
const COOLDOWN_HOURS = 24;
const COOLDOWN_FACTOR = 0.7;

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
    // COLD START: antes esto devolvía 1.0 (prioridad máxima).
    // Combinado con normalizeRecency (que también devolvía 1.0 para una
    // pregunta nunca respondida), cualquier pregunta nueva arrancaba con
    // 0.4 + 0.1 = 0.5 de score GARANTIZADO, por encima de casi cualquier
    // pregunta ya vista por débil que estuviera. En la práctica eso hacía
    // que Entrenamiento Inteligente funcionara más como "alimentador de
    // preguntas nuevas" que como repaso inteligente.
    // Con COLD_START_SCORE la pregunta nueva sigue siendo prioritaria
    // (0.75 es alto), pero ya no barre automáticamente con lo demás.
    return COLD_START_SCORE;
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
    // COLD START (ver normalizeFSRS): alta prioridad, no máxima.
    return COLD_START_SCORE;
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
  const { question, fsrsData, themeStats, lastAttempt, themeLastPracticed, fsrsOverride } = input;

  // Normalizar cada componente a [0, 1]
  // fsrsOverride llega cuando selectTrainingQuestions detectó saturación por
  // inactividad y sustituyó el valor absoluto por el ranking relativo.
  const fsrsScore       = fsrsOverride ?? normalizeFSRS(fsrsData);
  const themeScore      = normalizeTheme(themeStats);
  const importanceScore = normalizeImportance(question.importance);
  const recencyScore    = normalizeRecency(lastAttempt);

  // Suma ponderada según los pesos definidos arriba
  const rawScore =
    WEIGHTS.fsrs       * fsrsScore +
    WEIGHTS.theme      * themeScore +
    WEIGHTS.importance * importanceScore +
    WEIGHTS.recency    * recencyScore;

  // COOLDOWN: si este tema ya se trabajó en las últimas 24h, se reduce su
  // score para dejar espacio a otros temas en la próxima sesión.
  const cooldown = getCooldownFactor(themeLastPracticed ?? null);
  const score = rawScore * cooldown;

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

/**
 * Devuelve COOLDOWN_FACTOR si el tema se practicó dentro de las últimas
 * COOLDOWN_HOURS horas; 1 (sin penalización) en cualquier otro caso.
 */
function getCooldownFactor(themeLastPracticed: string | null): number {
  if (!themeLastPracticed) return 1;

  const last = new Date(themeLastPracticed);
  if (isNaN(last.getTime())) return 1;

  const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60);
  return hoursSince < COOLDOWN_HOURS ? COOLDOWN_FACTOR : 1;
}

// ─────────────────────────────────────────────
// Helpers estadísticos (para la reentrada tras inactividad)
// ─────────────────────────────────────────────

/** Mediana de una lista de números. Devuelve 0 si la lista está vacía. */
function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1] ?? 0;
    const upper = sorted[mid] ?? 0;
    return (lower + upper) / 2;
  }

  return sorted[mid] ?? 0;
}

/**
 * Convierte una lista de valores en su ranking percentil dentro de la propia
 * lista: el valor más bajo → 0, el más alto → 1, el resto repartido según su
 * posición. Preserva el orden original del arreglo de entrada.
 *
 * Esto es lo que restaura la capacidad de discriminar cuando todos los
 * valores absolutos están saturados cerca de 1.0.
 */
function toPercentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  // Emparejar cada valor con su índice original y ordenar de menor a mayor
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(n).fill(0);
  for (let position = 0; position < indexed.length; position++) {
    const entry = indexed[position];
    if (!entry) continue;
    ranks[entry.index] = position / (n - 1);
  }

  return ranks;
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
    themeLastPracticed?: string | null;
  }>,
  count: number
): T[] {
  if (questions.length === 0) return [];

  // ── REENTRADA TRAS INACTIVIDAD ──────────────────────────────────────────
  // El componente FSRS usa R = e^(-días/estabilidad), que decae exponencial.
  // Si el usuario pasa días o semanas sin estudiar, TODAS las preguntas
  // llegan a urgencia ~1.0 al mismo tiempo y el 40% del score se aplana:
  // el algoritmo deja de poder distinguir qué es más urgente justo cuando
  // más falta hace. Para evitarlo se mide la saturación del banco y, si es
  // alta, se sustituye el valor absoluto por el ranking RELATIVO dentro del
  // propio banco — así siempre hay una gradiente utilizable, sin importar
  // cuánto tiempo haya pasado desde la última sesión.
  const rawFsrs = questions.map((q) => normalizeFSRS(q.fsrsData));
  const useRelativeFsrs = median(rawFsrs) > SATURATION_THRESHOLD;
  const relativeFsrs = useRelativeFsrs ? toPercentileRanks(rawFsrs) : null;

  // 1. Calcular score para cada pregunta
  const scored: ScoredQuestion<T>[] = questions.map((item, index) => ({
    question: item.question,
    score: calculatePriorityScore({
      question:   item.question,
      fsrsData:   item.fsrsData,
      themeStats: item.themeStats,
      lastAttempt: item.lastAttempt,
      themeLastPracticed: item.themeLastPracticed ?? null,
      fsrsOverride: relativeFsrs ? relativeFsrs[index] : undefined,
    }).score,
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