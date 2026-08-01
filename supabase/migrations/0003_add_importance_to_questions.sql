-- ============================================================
-- Migración 0003: Agregar campo importance a questions
--
-- Este campo es exclusivo del modo "Entrenamiento Inteligente".
-- No afecta Flashcards ni ningún otro módulo.
--
-- importance: entero 1-5
--   1 = muy poco frecuente en ENARM
--   5 = extremadamente frecuente en ENARM
--   3 = valor por defecto (importancia media)
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS importance int NOT NULL DEFAULT 3
    CHECK (importance >= 1 AND importance <= 5);

COMMENT ON COLUMN public.questions.importance IS
  'Importancia ENARM del 1 al 5. Usado únicamente por el modo Entrenamiento Inteligente.';
