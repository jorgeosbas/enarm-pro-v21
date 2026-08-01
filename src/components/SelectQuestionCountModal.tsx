'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

interface SelectQuestionCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxQuestions: number;
  redirectTo?: string;
}

export function SelectQuestionCountModal({
  isOpen,
  onClose,
  maxQuestions,
  redirectTo = '/simulador',
}: SelectQuestionCountModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);

  useEffect(() => { setMounted(true); }, []);

  const isTraining = redirectTo.includes('entrenamiento');
  const title = isTraining ? 'Entrenamiento Inteligente' : 'Simulador';
  const description = isTraining
    ? 'El modo inteligente seleccionará las preguntas con mayor prioridad para ti.'
    : 'Se seleccionarán preguntas al azar de todo tu banco.';
  const icon = isTraining ? '🧠' : '🎯';
  const buttonLabel = isTraining ? 'Comenzar entrenamiento' : 'Comenzar simulador';

  function handleStart() {
    if (questionCount < 1 || questionCount > maxQuestions) {
      alert(`Selecciona entre 1 y ${maxQuestions} preguntas`);
      return;
    }
    onClose();
    router.push(`${redirectTo}?count=${questionCount}`);
  }

  if (!isOpen || !mounted) return null;

  const modal = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-indigo-300/50 bg-white/90 p-6 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0f0f1a]/95 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100/80 text-lg dark:bg-indigo-500/15">
                {icon}
              </div>
              <h2 className="text-[16px] font-medium text-[#1e1b4b] dark:text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 transition-colors hover:text-slate-700 dark:text-white/40 dark:hover:text-white/70"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="mb-5 text-[13px] text-slate-500 dark:text-white/40">{description}</p>

          {/* Input de cantidad */}
          <div className="mb-6">
            <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/35">
              Número de preguntas
            </label>
            <input
              type="number"
              min={1}
              max={maxQuestions}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-indigo-300/50 bg-white/75 px-4 py-2.5 text-[13px] text-[#1e1b4b] outline-none focus:border-indigo-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/85 dark:focus:border-indigo-400"
            />
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/25">
              Tienes {maxQuestions} preguntas disponibles
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={handleStart}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {buttonLabel}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-indigo-300/50 bg-white/65 px-5 py-2.5 text-[14px] text-slate-700 backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
