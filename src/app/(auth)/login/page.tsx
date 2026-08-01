'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f4f3ff] px-4 dark:bg-[#0a0a14]">
      {/* Blobs */}
      <div className="pointer-events-none fixed left-[-80px] top-[-80px] h-[340px] w-[340px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/18" style={{ filter: 'blur(90px)' }} />
      <div className="pointer-events-none fixed right-[20px] top-[60px] h-[280px] w-[280px] rounded-full bg-purple-400/16 dark:bg-purple-500/14" style={{ filter: 'blur(80px)' }} />
      <div className="pointer-events-none fixed bottom-[20px] left-[160px] h-[220px] w-[220px] rounded-full bg-cyan-400/12 dark:bg-cyan-400/10" style={{ filter: 'blur(70px)' }} />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-3xl font-medium text-transparent">
            ENARM
          </span>
          <span className="ml-1.5 text-sm font-medium text-slate-400 dark:text-white/30">Pro</span>
          <p className="mt-2 text-[13px] text-slate-400 dark:text-white/40">
            Tu centro de preparación para el ENARM
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-indigo-200/40 bg-white/70 p-8 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0f0f1a]/90">
          <h1 className="mb-1 text-[16px] font-medium text-[#1e1b4b] dark:text-white">
            Iniciar sesión
          </h1>
          <p className="mb-6 text-[13px] text-slate-400 dark:text-white/40">
            Ingresa tus credenciales para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:placeholder:text-white/20 dark:focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-white/35">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-indigo-200/40 bg-white/70 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:placeholder:text-white/20 dark:focus:border-indigo-400"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
