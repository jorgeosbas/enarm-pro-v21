export type FlashcardState = 'new' | 'learning' | 'review' | 'relearning';

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardProgress {
  id: string;
  user_id: string;
  question_id: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: FlashcardState;
  last_review: string | null;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface FlashcardWithProgress {
  id: string;
  sequence_number: number | null;
  theme_id: string | null;
  subcategory_id: string;
  difficulty: string;
  vignette: string;
  explanation: string | null;
  options: Array<{
    id: string;
    label: string;
    content: string;
    is_correct: boolean;
  }>;
  subcategory?: {
    id: string;
    name: string;
    specialty?: {
      id: string;
      name: string;
    };
  };
  theme?: {
    id: string;
    name: string;
  } | null;
  progress: FlashcardProgress;
}

export interface FSRSParameters {
  w: number[]; // Weights para el algoritmo
  request_retention: number; // Target de retención (0.9 = 90%)
  maximum_interval: number; // Intervalo máximo en días (e.g., 36500 = 100 años)
}

// Parámetros por defecto de FSRS
export const DEFAULT_FSRS_PARAMS: FSRSParameters = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.52, 0.62, 2.33],
  request_retention: 0.9,
  maximum_interval: 36500,
};
