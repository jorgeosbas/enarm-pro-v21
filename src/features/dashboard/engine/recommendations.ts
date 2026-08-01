/**
 * Motor de recomendaciones del Dashboard
 *
 * Reglas determinísticas puras. Sin IA, sin ML, sin inferencias.
 * Solo datos reales del usuario → conclusiones simples.
 *
 * Filosofía: el Dashboard debe actuar como entrenador, no como juez.
 * Nunca castigar, siempre proponer el siguiente paso.
 */

import type { DashboardStats } from '../hooks/useDashboardStats';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StudyMode = 'flashcards' | 'entrenamiento' | 'simulador' | 'tema';

export interface DailyRecommendation {
  /** Modo principal recomendado */
  mode: StudyMode;
  /** Título de la recomendación */
  title: string;
  /** Descripción breve */
  description: string;
  /** Items de la sesión sugerida */
  items: string[];
  /** Tiempo estimado en minutos */
  estimatedMinutes: number;
  /** Si es un usuario nuevo sin historial */
  isNewUser: boolean;
}

export interface Insight {
  /** Emoji / icono textual */
  icon: string;
  /** Texto del insight — accionable, nunca punitivo */
  text: string;
  /** Prioridad para ordenar (menor = más urgente) */
  priority: number;
}

// ─── Constantes de umbrales ───────────────────────────────────────────────────

const MIN_ANSWERS_FOR_INSIGHTS = 20;   // Mínimo de respuestas para insights comparativos
const DAYS_SINCE_SIMULATOR_ALERT = 7; // Días sin simulador para sugerirlo
const WEAK_SPECIALTY_THRESHOLD = 60;  // % de aciertos por debajo del cual es "débil"
const STRONG_SPECIALTY_THRESHOLD = 80; // % de aciertos por encima del cual es "fuerte"
const MIN_SPECIALTY_ANSWERS = 5;       // Mínimo de respuestas por especialidad para comparar

// Tiempo estimado por pregunta en minutos
const MINUTES_PER_FLASHCARD = 1.5;
const MINUTES_PER_QUIZ_QUESTION = 1.2;

// ─── Motor de recomendación diaria ───────────────────────────────────────────

/**
 * Genera la recomendación principal del día.
 * Orden de prioridad con desempate: Flashcards → Entrenamiento → Simulador → Tema
 */
export function buildDailyRecommendation(
  stats: DashboardStats | undefined,
  isLoading: boolean
): DailyRecommendation {
  // Sin datos todavía
  if (isLoading || !stats) {
    return newUserRecommendation();
  }

  const isNewUser = stats.totalAnswers < MIN_ANSWERS_FOR_INSIGHTS && stats.flashcardsDueCount === 0;

  if (isNewUser) {
    return newUserRecommendation();
  }

  // Regla 1: ¿Hay Flashcards pendientes? → prioridad máxima
  if (stats.flashcardsDueCount > 0) {
    const flashMins = Math.ceil(stats.flashcardsDueCount * MINUTES_PER_FLASHCARD);
    const quizMins = Math.ceil(20 * MINUTES_PER_QUIZ_QUESTION);
    const items = [`${stats.flashcardsDueCount} Flashcards pendientes`];

    // Si hay tiempo, sugerir también el Entrenamiento
    if (stats.totalQuestions >= 10) {
      items.push('Quiz Inteligente de 20 preguntas');
    }

    return {
      mode: 'flashcards',
      title: 'Tu sesión de hoy',
      description: 'Empieza por las Flashcards para proteger lo que ya aprendiste.',
      items,
      estimatedMinutes: flashMins + (stats.totalQuestions >= 10 ? quizMins : 0),
      isNewUser: false,
    };
  }

  // Regla 2: ¿Lleva muchos días sin Simulador?
  if (
    stats.daysSinceLastSimulator !== null &&
    stats.daysSinceLastSimulator >= DAYS_SINCE_SIMULATOR_ALERT &&
    stats.totalAnswers >= MIN_ANSWERS_FOR_INSIGHTS
  ) {
    return {
      mode: 'simulador',
      title: 'Evalúa tu avance',
      description: 'Un Simulador es una excelente forma de medir tu preparación actual.',
      items: ['Simulador de 30 preguntas', 'Revisa tus resultados al terminar'],
      estimatedMinutes: Math.ceil(30 * MINUTES_PER_QUIZ_QUESTION),
      isNewUser: false,
    };
  }

  // Regla 3: ¿Hay una especialidad claramente débil con suficientes datos?
  const weakSpecialty = getWeakestSpecialty(stats);
  if (weakSpecialty) {
    return {
      mode: 'entrenamiento',
      title: 'Refuerza tus puntos débiles',
      description: `Reforzar ${weakSpecialty.name} puede mejorar tu dominio global.`,
      items: ['Quiz Inteligente de 20 preguntas', `Foco en ${weakSpecialty.name}`],
      estimatedMinutes: Math.ceil(20 * MINUTES_PER_QUIZ_QUESTION),
      isNewUser: false,
    };
  }

  // Regla 4: Todo bien → recomendar Entrenamiento para mantener el ritmo
  return {
    mode: 'entrenamiento',
    title: 'Mantén el ritmo',
    description: 'Tu progreso está en buen camino. Un Quiz Inteligente ayuda a mantenerlo.',
    items: ['Quiz Inteligente de 20 preguntas'],
    estimatedMinutes: Math.ceil(20 * MINUTES_PER_QUIZ_QUESTION),
    isNewUser: false,
  };
}

// ─── Motor de Insights ────────────────────────────────────────────────────────

/**
 * Genera hasta 3 insights con la mayor prioridad.
 * Nunca punitivos, siempre accionables.
 */
export function buildInsights(stats: DashboardStats | undefined): Insight[] {
  if (!stats) return [];

  const candidates: Insight[] = [];

  // Insight: Flashcards pendientes
  if (stats.flashcardsDueCount > 0) {
    candidates.push({
      icon: '🗂',
      text: `Tienes ${stats.flashcardsDueCount} Flashcard${stats.flashcardsDueCount !== 1 ? 's' : ''} por repasar hoy.`,
      priority: 1,
    });
  } else if (stats.flashcardsDominatedCount > 0) {
    candidates.push({
      icon: '✅',
      text: 'Sin Flashcards pendientes hoy. Buen momento para aprender contenido nuevo.',
      priority: 5,
    });
  }

  // Insight: Días sin simulador (solo con historial suficiente)
  if (
    stats.totalAnswers >= MIN_ANSWERS_FOR_INSIGHTS &&
    stats.daysSinceLastSimulator !== null &&
    stats.daysSinceLastSimulator >= DAYS_SINCE_SIMULATOR_ALERT
  ) {
    candidates.push({
      icon: '🎯',
      text: `Un Simulador es una buena forma de medir dónde estás ahora mismo.`,
      priority: 2,
    });
  }

  // Insight: Especialidad débil (solo con muestra suficiente)
  if (stats.totalAnswers >= MIN_ANSWERS_FOR_INSIGHTS) {
    const weak = getWeakestSpecialty(stats);
    if (weak) {
      candidates.push({
        icon: '⚠️',
        text: `Reforzar ${weak.name} podría mejorar tu rendimiento global.`,
        priority: 2,
      });
    }

    // Insight: Mejor especialidad
    const best = getBestSpecialty(stats);
    if (best) {
      candidates.push({
        icon: '⭐',
        text: `${best.name} es actualmente tu especialidad más sólida con ${best.accuracy}%.`,
        priority: 6,
      });
    }
  }

  // Insight: Racha activa
  if (stats.streakDays >= 3) {
    candidates.push({
      icon: '🔥',
      text: `Llevas ${stats.streakDays} días seguidos estudiando. ¡Sigue así!`,
      priority: 4,
    });
  }

  // Insight: Primer simulador (nunca ha hecho uno)
  if (stats.daysSinceLastSimulator === null && stats.totalAnswers >= MIN_ANSWERS_FOR_INSIGHTS) {
    candidates.push({
      icon: '🎯',
      text: 'Todavía no has realizado tu primer Simulador. Es una excelente forma de conocer tu nivel.',
      priority: 3,
    });
  }

  // Insight: Dominio global bueno
  if (stats.globalAccuracy !== null && stats.globalAccuracy >= 75) {
    candidates.push({
      icon: '📈',
      text: `Tu dominio global es ${stats.globalAccuracy}%. Estás en una buena trayectoria.`,
      priority: 7,
    });
  }

  // Insight positivo cuando hay pocos datos
  if (stats.totalAnswers > 0 && stats.totalAnswers < MIN_ANSWERS_FOR_INSIGHTS) {
    candidates.push({
      icon: '📊',
      text: 'A medida que estudies iremos personalizando tus recomendaciones.',
      priority: 8,
    });
  }

  // Ordenar por prioridad y devolver máximo 3, sin duplicados temáticos
  return candidates.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function newUserRecommendation(): DailyRecommendation {
  return {
    mode: 'entrenamiento',
    title: 'Bienvenido',
    description:
      'Todavía estamos conociendo tu forma de estudiar. Empieza con un Quiz para generar tus primeras estadísticas.',
    items: ['Quiz Inteligente de 10 preguntas', 'O un Quiz por Tema de tu elección'],
    estimatedMinutes: Math.ceil(10 * MINUTES_PER_QUIZ_QUESTION),
    isNewUser: true,
  };
}

function getWeakestSpecialty(stats: DashboardStats) {
  if (!stats.specialtyStats.length) return null;
  const qualified = stats.specialtyStats.filter(
    (s) => s.total >= MIN_SPECIALTY_ANSWERS && s.accuracy < WEAK_SPECIALTY_THRESHOLD
  );
  if (!qualified.length) return null;
  return qualified.sort((a, b) => a.accuracy - b.accuracy)[0];
}

function getBestSpecialty(stats: DashboardStats) {
  if (!stats.specialtyStats.length) return null;
  const qualified = stats.specialtyStats.filter(
    (s) => s.total >= MIN_SPECIALTY_ANSWERS && s.accuracy >= STRONG_SPECIALTY_THRESHOLD
  );
  if (!qualified.length) return null;
  return qualified.sort((a, b) => b.accuracy - a.accuracy)[0];
}

// ─── Métricas para la sección "Mi Progreso" ───────────────────────────────────

export interface ProgressMetric {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color: 'indigo' | 'emerald' | 'amber' | 'violet';
}

export function buildProgressMetrics(stats: DashboardStats | undefined): ProgressMetric[] {
  if (!stats) return [];

  return [
    {
      icon: '🔥',
      label: 'Racha',
      value: stats.streakDays > 0 ? `${stats.streakDays}` : '0',
      sub: stats.streakDays === 1 ? 'día seguido' : 'días seguidos',
      color: 'indigo',
    },
    {
      icon: '📈',
      label: 'Dominio global',
      value: stats.globalAccuracy !== null ? `${stats.globalAccuracy}%` : '—',
      sub: stats.totalAnswers >= MIN_ANSWERS_FOR_INSIGHTS
        ? `${stats.totalAnswers} respuestas`
        : 'Responde más para calcular',
      color: 'emerald',
    },
    {
      icon: '📝',
      label: 'Respondidas',
      value: `${stats.totalAnswers}`,
      sub: 'preguntas en total',
      color: 'amber',
    },
    {
      icon: '🧠',
      label: 'Dominadas',
      value: `${stats.flashcardsDominatedCount}`,
      sub: 'flashcards en revisión',
      color: 'violet',
    },
  ];
}
