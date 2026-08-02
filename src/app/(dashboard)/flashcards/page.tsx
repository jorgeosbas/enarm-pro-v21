'use client';
import { LoadingScreen } from '@/components/LoadingScreen';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDueFlashcards } from '@/features/flashcards/hooks/useDueFlashcards';
import { updateFlashcardProgressAction, initializeAllFlashcardsAction } from '@/features/flashcards/actions/updateProgress';
import { FlashcardCard } from '@/components/FlashcardCard';
import { FlashcardRating, FlashcardWithProgress } from '@/features/flashcards/types';

export default function FlashcardsPage() {
  const router = useRouter();

  // Extraemos SOLO refetch. Ignoramos la caché local de React Query.
  const { refetch } = useDueFlashcards();

  // queue = null significa "Estamos cargando la verdad absoluta"
  const [queue, setQueue] = useState<FlashcardWithProgress[] | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalInitial, setTotalInitial] = useState(0);
  const [isRating, setIsRating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        // 1. Pedimos los datos frescos a Supabase directo (ignorando cachés)
        const { data, error } = await refetch();

        if (error) throw error;

        let finalData = data || [];

        // 2. Si viene vacío, revisamos si hay tarjetas nuevas por inicializar en el backend
        if (finalData.length === 0) {
          const result = await initializeAllFlashcardsAction();
          if (result.success && result.initialized > 0) {
            const { data: newData } = await refetch(); // Volvemos a pedir si se generaron nuevas
            finalData = newData || [];
          }
        }

        // 3. Establecemos la cola definitiva
        if (isMounted) {
          setQueue(finalData);
          setTotalInitial(finalData.length);
          setCompletedCount(0);
        }
      } catch (err) {
        console.error('[flashcards/page] Error al refrescar datos:', err);
        if (isMounted) {
          setErrorMsg('Hubo un error de conexión al cargar tus tarjetas.');
          setQueue([]); // Evitamos que la pantalla se quede cargando infinitamente
        }
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [refetch]);

  // ==========================================
  // ESTADO 1: Cargando (Evita los fantasmas)
  // ==========================================
  if (queue === null) {
    return (
      <LoadingScreen message="Preparando tu sesión de flashcards..." />
    );
  }

  // ==========================================
  // ESTADO 2: Error
  // ==========================================
  if (errorMsg) {
    return (
      <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
        <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
        
        <main className="relative z-10 mx-auto max-w-2xl px-4 pt-10">
          <div className="rounded-xl border border-rose-300/50 bg-rose-100/55 p-5 backdrop-blur-md dark:border-rose-400/20 dark:bg-rose-500/[0.07]">
            <p className="text-[13px] text-rose-700 dark:text-rose-300">{errorMsg}</p>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // ESTADO 3: Sin tarjetas
  // ==========================================
  if (queue.length === 0) {
    return (
      <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
        <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
        <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />
        
        <main className="relative z-10 mx-auto max-w-2xl px-4 pb-24 pt-10 text-center">
          <div className="rounded-2xl border border-emerald-300/50 bg-white/70 p-12 backdrop-blur-md dark:border-emerald-400/20 dark:bg-white/[0.04]">
            <div className="mb-4 text-5xl">🎉</div>
            <h2 className="mb-2 text-[18px] font-medium text-[#1e1b4b] dark:text-white">¡Al día con tus flashcards!</h2>
            <p className="mb-6 text-[13px] text-slate-500 dark:text-white/40">
              Has completado todas las tarjetas de hoy. Vuelve mañana para continuar.
            </p>
            <button onClick={() => router.push('/banco-preguntas')} className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90">
              Ir al Banco de Preguntas
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // ESTADO 4: Mostrando tarjeta activa
  // ==========================================
  const currentFlashcard = queue[0];

  async function handleRate(rating: FlashcardRating) {
    if (isRating || !currentFlashcard) return;

    setIsRating(true);
    try {
      const targetQuestionId = currentFlashcard.progress?.question_id || currentFlashcard.id;
      const res = await updateFlashcardProgressAction(targetQuestionId, rating);

      if (!res.success) {
        if (res.error === 'session_expired') {
          router.refresh();
          return;
        }
        alert(`No se pudo guardar la respuesta: ${res.error || 'Error de conexión'}`);
        return;
      }

      // Avanzar cola local de manera segura para TypeScript
      if (rating === 'again') {
        setQueue((prev) => {
          if (!prev || prev.length <= 1) return prev;
          const first = prev[0];
          if (!first) return prev;
          return [...prev.slice(1), first];
        });
      } else {
        setCompletedCount((prev) => prev + 1);
        setQueue((prev) => (prev === null ? null : prev.slice(1)));
      }
    } catch (err) {
      console.error('Error rating flashcard:', err);
      alert('Error al guardar tu respuesta. Intenta de nuevo.');
    } finally {
      setIsRating(false);
    }
  }

  if (!currentFlashcard) return null;

  const percentComplete = totalInitial > 0
    ? Math.min(100, Math.round((completedCount / totalInitial) * 100))
    : 0;

  return (
    <div className="relative min-h-screen bg-[#e9e3fb] dark:bg-[#0a0a14]">
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />

      

      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-10 lg:px-6">
        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#1e1b4b] dark:text-white/80">
              Progreso: {completedCount} de {totalInitial}
            </span>
            <span className="text-[12px] text-slate-500 dark:text-white/35">
              {percentComplete}% · {queue.length} en cola
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-indigo-300/40 bg-white/60 dark:border-transparent dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {/* Chips de categoría */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {currentFlashcard.subcategory?.specialty?.name && (
            <span className="rounded-full border border-indigo-300/50 bg-indigo-100/60 px-3 py-1 text-[12px] text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/15 dark:text-indigo-300">
              {currentFlashcard.subcategory.specialty.name}
            </span>
          )}
          {currentFlashcard.subcategory?.name && (
            <span className="rounded-full border border-indigo-300/50 bg-white/70 px-3 py-1 text-[12px] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
              {currentFlashcard.subcategory.name}
            </span>
          )}
          {currentFlashcard.theme && (
            <span className="rounded-full border border-amber-300/50 bg-amber-100/60 px-3 py-1 text-[12px] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
              {currentFlashcard.theme.name}
            </span>
          )}
        </div>

        <div key={`wrap-${currentFlashcard.id}-${queue.length}`} className="animate-scale-in">
          <FlashcardCard
            key={`${currentFlashcard.id}-${queue.length}`}
            flashcard={currentFlashcard}
            onRate={handleRate}
            isLoading={isRating}
            currentIndex={completedCount}
            totalCards={totalInitial}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => router.push('/banco-preguntas')} className="rounded-xl border border-indigo-300/50 bg-white/65 px-4 py-2.5 text-[13px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
            ← Banco
          </button>
          <button onClick={() => router.push('/dashboard')} className="rounded-xl border border-indigo-300/50 bg-white/65 px-4 py-2.5 text-[13px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50">
            Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}