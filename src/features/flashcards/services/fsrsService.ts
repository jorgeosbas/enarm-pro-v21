import { Card, Rating, State, fsrs } from 'ts-fsrs';
import { FlashcardProgress, FlashcardRating } from '../types';

/**
 * Convierte un string o número de estado ('new', 'learning', 'review', 'relearning') 
 * al Enum State de ts-fsrs (0=new, 1=learning, 2=review, 3=relearning)
 */
export function parseState(stateStr: string | number): State {
  if (typeof stateStr === 'number') {
    return stateStr as State;
  }
  
  switch (stateStr?.toLowerCase()) {
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    case 'new':
    default:
      return State.New;
  }
}

export function getStateIndex(state: string | number): number {
  return parseState(state);
}

export function convertRating(rating: FlashcardRating): Rating {
  const ratingMap: Record<FlashcardRating, Rating> = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  };
  return ratingMap[rating];
}

export function convertToUIRating(rating: Rating): FlashcardRating {
  const ratingMap: Record<number, FlashcardRating> = {
    1: 'again',
    2: 'hard',
    3: 'good',
    4: 'easy',
  };
  return ratingMap[rating] ?? 'good';
}

export function createCardFromProgress(progress: FlashcardProgress): Card {
  const rawDue = progress?.due_date ? new Date(progress.due_date) : new Date();
  const validDue = !isNaN(rawDue.getTime()) ? rawDue : new Date();

  const rawReview = progress?.last_review ? new Date(progress.last_review) : undefined;
  const validReview = rawReview && !isNaN(rawReview.getTime()) ? rawReview : undefined;

  return {
    due: validDue,
    stability: progress?.stability ?? 1.0,
    difficulty: progress?.difficulty ?? 5.0,
    elapsed_days: progress?.elapsed_days ?? 0,
    scheduled_days: progress?.scheduled_days ?? 1,
    reps: progress?.reps ?? 0,
    lapses: progress?.lapses ?? 0,
    state: parseState(progress?.state || 'new'),
    last_review: validReview,
  };
}

/**
 * FSRS-4 (implementado por ts-fsrs 3.x) espera EXACTAMENTE 17 pesos.
 * Si se le pasan menos, los índices faltantes quedan undefined y el
 * cálculo produce NaN de forma silenciosa.
 */
const EXPECTED_W_LENGTH = 17;

/**
 * Pesos oficiales por defecto de FSRS-4 (17 valores).
 *
 * ANTES aquí había solo 14 valores. Los índices 14, 15 y 16 quedaban
 * undefined, y son precisamente los que usan:
 *   - w[14] → Repetir (estabilidad tras olvido)
 *   - w[15] → Difícil (penalización)
 *   - w[16] → Fácil (bonificación)
 * Es decir: "Bien" era la única calificación que funcionaba completa.
 *
 * Si algún día quieres personalizarlos (FSRS permite optimizarlos con tu
 * propio historial), debe seguir siendo un arreglo de EXACTAMENTE 17.
 */
const FSRS_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34,
  1.26, 0.29, 2.61,
];

/**
 * Valida que el resultado del cálculo sea utilizable.
 *
 * Sin esta comprobación, un resultado con NaN se acepta como válido y más
 * abajo `daysToAdd > 0` da false (porque NaN nunca es mayor que nada),
 * cayendo al caso "Again" → la tarjeta se reprograma a 10 minutos aunque
 * el usuario haya marcado "Fácil".
 */
function isUsableResult(card: Card | undefined | null): boolean {
  if (!card) return false;
  return (
    Number.isFinite((card as any).stability) &&
    Number.isFinite((card as any).difficulty) &&
    Number.isFinite((card as any).scheduled_days)
  );
}

/**
 * Calcular siguiente estado con FSRS
 */
export function calculateFSRS(
  card: Card,
  rating: Rating,
  now: Date = new Date()
) {
  const DAY_MS = 24 * 60 * 60 * 1000;

  if (FSRS_WEIGHTS.length !== EXPECTED_W_LENGTH) {
    console.warn(
      `[FSRS] Configuración incompleta: se pasaron ${FSRS_WEIGHTS.length} pesos ` +
        `pero FSRS-4 espera ${EXPECTED_W_LENGTH}. Los cálculos de Repetir/Difícil/Fácil ` +
        `pueden producir valores inválidos y caer al cálculo manual de respaldo.`
    );
  }

  const f = fsrs({
    w: FSRS_WEIGHTS,
    request_retention: 0.9,
    maximum_interval: 36500,
  });

  let calculatedResult: { card: Card; log: any } | null = null;
  let sourceUsed: 'repeat' | 'next' | 'manual' = 'manual';

  try {
    const schedulingCards = (f as any).repeat(card, now);
    const result = schedulingCards?.[rating];
    if (isUsableResult(result?.card)) {
      calculatedResult = { card: result.card, log: result.log ?? null };
      sourceUsed = 'repeat';
    }
  } catch (err) {
    console.error('[FSRS] Falló el método repeat():', err);
  }

  if (!calculatedResult) {
    try {
      const result = (f as any).next(card, now, rating);
      if (isUsableResult(result?.card)) {
        calculatedResult = { card: result.card, log: result.log ?? null };
        sourceUsed = 'next';
      }
    } catch (err) {
      console.error('[FSRS] Falló el método next():', err);
    }
  }

  if (!calculatedResult) {
    console.warn(
      `[FSRS] La librería no devolvió un resultado utilizable para rating=${rating}. ` +
        `Usando el cálculo manual de respaldo (menos preciso que FSRS).`
    );
    calculatedResult = calculateFSRSManual(card, rating, now);
    sourceUsed = 'manual';
  }

  // Marca de diagnóstico: permite saber qué ruta se usó realmente en producción.
  if (typeof window !== 'undefined') {
    (window as any).__fsrsLastSource = sourceUsed;
  }

  // SOLUCIÓN DEFINITIVA: Descongelar el objeto clonándolo
  const finalCard = { ...calculatedResult.card };

  // Forzar que los botones avancen los días sí o sí
  let daysToAdd = finalCard.scheduled_days;

  // Red de seguridad extra: si aun así llegó un valor no numérico, tratarlo
  // como 0 en vez de dejar que NaN se propague hasta el cálculo de la fecha.
  if (!Number.isFinite(daysToAdd)) daysToAdd = 0;

  // Intervención de seguridad por si FSRS se queda en 0 días para respuestas positivas
  if (rating === Rating.Easy && daysToAdd < 4) daysToAdd = 4;
  if (rating === Rating.Good && daysToAdd < 1) daysToAdd = 1;

  if (daysToAdd > 0) {
    // Sumar los días estrictamente al tiempo actual
    finalCard.due = new Date(now.getTime() + daysToAdd * DAY_MS);
    finalCard.scheduled_days = daysToAdd;
  } else {
    // Si falló (Again), ponerla para dentro de 10 minutos
    finalCard.due = new Date(now.getTime() + 10 * 60 * 1000);
  }

  return { card: finalCard, log: calculatedResult.log };
}

function calculateFSRSManual(
  card: Card,
  rating: Rating,
  now: Date
): { card: Card; log: null } {
  const isNew = card.reps === 0;
  let intervalDays: number;
  let newStability = card.stability;
  let newDifficulty = card.difficulty;
  let newState: State;
  let newReps = card.reps;
  let newLapses = card.lapses;

  if (rating === Rating.Again) {
    intervalDays = 0;
    newStability = Math.max(1, card.stability * 0.2);
    newDifficulty = Math.min(10, card.difficulty + 0.5);
    newState = card.reps > 0 ? State.Relearning : State.Learning;
    newLapses = card.lapses + 1;
    newReps = 0;
  } else if (rating === Rating.Hard) {
    intervalDays = isNew ? 1 : Math.max(1, Math.round(card.scheduled_days * 1.2));
    newStability = card.stability * 1.1;
    newDifficulty = Math.min(10, card.difficulty + 0.15);
    newState = isNew ? State.Learning : State.Review;
    newReps = card.reps + 1;
  } else if (rating === Rating.Good) {
    intervalDays = isNew ? 1 : Math.max(1, Math.round(card.scheduled_days * 2.0));
    newStability = card.stability * 1.5;
    newDifficulty = Math.max(1, card.difficulty - 0.1);
    newState = isNew ? State.Learning : State.Review;
    newReps = card.reps + 1;
  } else {
    intervalDays = isNew ? 4 : Math.max(4, Math.round(card.scheduled_days * 2.5));
    newStability = card.stability * 2.0;
    newDifficulty = Math.max(1, card.difficulty - 0.2);
    newState = State.Review;
    newReps = card.reps + 1;
  }

  const nextCard: Card = {
    ...card,
    due: new Date(), // Se sobreescribe en la función principal
    stability: Math.round(newStability * 100) / 100,
    difficulty: Math.round(newDifficulty * 100) / 100,
    elapsed_days: card.scheduled_days,
    scheduled_days: intervalDays,
    reps: newReps,
    lapses: newLapses,
    state: newState,
    last_review: now,
  };

  return { card: nextCard, log: null };
}

export function getStateString(stateIndex: number): string {
  const states = ['new', 'learning', 'review', 'relearning'];
  return states[stateIndex] || 'new';
}