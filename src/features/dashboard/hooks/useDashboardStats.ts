import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface DashboardStats {
  flashcardsDueCount: number;
  flashcardsDominatedCount: number;
  totalQuestions: number;
  totalAnswers: number;
  answersLast24h: number;
  correctLast24h: number;
  accuracyLast24h: number | null;
  daysSinceLastSimulator: number | null;
  streakDays: number;
  globalAccuracy: number | null;
  recentAnswers: Array<{
    question_id: string;
    is_correct: boolean;
    created_at: string;
    vignette_short: string;
    specialty_name: string;
  }>;
  specialtyStats: Array<{
    name: string;
    total: number;
    correct: number;
    accuracy: number;
  }>;
  dailyAccuracy: Array<{
    date: string;
    accuracy: number;
    total: number;
  }>;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async (): Promise<DashboardStats> => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const userId = user.id;
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // ── 1. Flashcards pendientes ──────────────────────────────────────────
      const { data: dueFlashcards } = await supabase
        .from('user_flashcard_progress')
        .select('id')
        .eq('user_id', userId)
        .lte('due_date', now.toISOString());

      // ── 2. Flashcards dominadas ───────────────────────────────────────────
      const { count: dominatedCount } = await supabase
        .from('user_flashcard_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('state', 'review')
        .gte('reps', 3);

      // ── 3. Total preguntas ────────────────────────────────────────────────
      // Banco Compartido: el conteo es del banco completo, no solo de las
      // preguntas que importó este usuario. Antes filtraba por user_id, por
      // lo que un usuario nuevo veía siempre "0 preguntas importadas" aunque
      // el banco ya tuviera contenido.
      const { count: totalQuestions } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true });

      // ── 4. Answer logs — query simple sin joins anidados ──────────────────
      // Separamos en dos queries para evitar el error 400 de Supabase
      // que ocurre con joins profundos (answer_logs → questions → subcategories → specialties)
      const { data: rawLogs, error: logsError } = await supabase
        .from('answer_logs')
        .select('id, question_id, is_correct, answered_at')
        .eq('user_id', userId)
        .order('answered_at', { ascending: false });

      if (logsError) {
        console.error('[useDashboardStats] Error fetching answer_logs:', logsError);
      }

      const logs = rawLogs || [];
      const totalAnswers = logs.length;

      // ── 5. Traer especialidades de las preguntas respondidas ──────────────
      // Solo hacemos esta query si hay respuestas
      const specialtyByQuestion: Record<string, string> = {};
      const vignetteByQuestion: Record<string, string> = {};

      if (logs.length > 0) {
        const questionIds = [...new Set(logs.map((l: any) => l.question_id))];

        const { data: questionsData } = await supabase
          .from('questions')
          .select(`
            id,
            vignette,
            subcategory:subcategories(
              specialty:specialties(name)
            )
          `)
          .in('id', questionIds);

        (questionsData || []).forEach((q: any) => {
          specialtyByQuestion[q.id] = q.subcategory?.specialty?.name || 'General';
          vignetteByQuestion[q.id] = q.vignette || '';
        });
      }

      // ── 6. Métricas globales ──────────────────────────────────────────────
      const totalCorrect = logs.filter((l: any) => l.is_correct).length;
      const globalAccuracy = totalAnswers >= 5
        ? Math.round((totalCorrect / totalAnswers) * 100)
        : null;

      // ── 7. Últimas 24h ────────────────────────────────────────────────────
      const recentLogs = logs.filter(
        (l: any) => new Date(l.answered_at) >= yesterday
      );
      const answersLast24h = recentLogs.length;
      const correctLast24h = recentLogs.filter((r: any) => r.is_correct).length;
      const accuracyLast24h = answersLast24h > 0
        ? Math.round((correctLast24h / answersLast24h) * 100)
        : null;

      // ── 8. Actividad reciente (últimas 5) ─────────────────────────────────
      const recentAnswers = logs.slice(0, 5).map((r: any) => ({
        question_id: r.question_id || '',
        is_correct: r.is_correct,
        created_at: r.answered_at,  // campo real: answered_at
        vignette_short: (vignetteByQuestion[r.question_id] || '').slice(0, 48),
        specialty_name: specialtyByQuestion[r.question_id] || 'General',
      }));

      // ── 9. Stats por especialidad ─────────────────────────────────────────
      const specialtyMap: Record<string, { total: number; correct: number }> = {};
      logs.forEach((log: any) => {
        const name = specialtyByQuestion[log.question_id] || 'General';
        if (!specialtyMap[name]) specialtyMap[name] = { total: 0, correct: 0 };
        specialtyMap[name].total++;
        if (log.is_correct) specialtyMap[name].correct++;
      });

      const specialtyStats = Object.entries(specialtyMap)
        .map(([name, s]) => ({
          name,
          total: s.total,
          correct: s.correct,
          accuracy: Math.round((s.correct / s.total) * 100),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      // ── 10. Racha de días ─────────────────────────────────────────────────
      let streakDays = 0;
      if (logs.length > 0) {
        const activeDays = new Set(
          logs.map((l: any) => {
            const d = new Date(l.answered_at);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          })
        );
        for (let i = 0; i < 365; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (activeDays.has(key)) streakDays++;
          else break;
        }
      }

      // ── 11. Días desde último uso ─────────────────────────────────────────
      let daysSinceLastSimulator: number | null = null;
      if (logs.length > 0) {
        const lastDate = new Date((logs[0] as any).answered_at);
        daysSinceLastSimulator = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      // ── 12. Historial diario 30 días ──────────────────────────────────────
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentForChart = logs.filter(
        (l: any) => new Date(l.answered_at) >= thirtyDaysAgo
      );

      const dailyMap: Record<string, { correct: number; total: number }> = {};
      recentForChart.forEach((l: any) => {
        const d = new Date(l.answered_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!dailyMap[key]) dailyMap[key] = { correct: 0, total: 0 };
        dailyMap[key].total++;
        if (l.is_correct) dailyMap[key].correct++;
      });

      const dailyAccuracy = Object.entries(dailyMap)
        .map(([date, v]) => ({
          date,
          accuracy: Math.round((v.correct / v.total) * 100),
          total: v.total,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        flashcardsDueCount: dueFlashcards?.length || 0,
        flashcardsDominatedCount: dominatedCount || 0,
        totalQuestions: totalQuestions || 0,
        totalAnswers,
        answersLast24h,
        correctLast24h,
        accuracyLast24h,
        daysSinceLastSimulator,
        streakDays,
        globalAccuracy,
        recentAnswers,
        specialtyStats,
        dailyAccuracy,
      };
    },
    staleTime: 0,               // Siempre refetch al volver al dashboard
    refetchOnWindowFocus: true, // Actualiza al regresar a la pestaña
    refetchOnMount: true,       // Actualiza al montar el componente
  });
}