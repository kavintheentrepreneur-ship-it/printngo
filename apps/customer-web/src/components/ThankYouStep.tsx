'use client';

import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Printer, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ThankYouStepProps {
  referenceCode: string;
}

export function ThankYouStep({ referenceCode }: ThankYouStepProps) {
  const [isCompletedSession, setIsCompletedSession] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mediaQuery.matches) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#f59e0b', '#6366f1'],
        });
      } catch (e) {
        console.warn('Confetti animation suppressed:', e);
      }
    }
  }, []);

  if (isCompletedSession) {
    return (
      <div className="flex min-h-[500px] flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-700 mb-4">
          <CheckCircle2 className="h-8 w-8 text-brand-600" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
          Thank you!
        </h2>
        <p className="text-sm font-medium text-slate-600 max-w-xs mb-4">
          You can close this page now. Your documents are printing at the kiosk.
        </p>
        <span className="font-mono text-xs font-bold text-slate-400">
          Ref: {referenceCode}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[550px] flex-1 flex-col items-center justify-center p-6 text-center">
      {/* Success Badge */}
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-500 text-white shadow-xl shadow-brand-500/25 mb-6">
        <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
      </div>

      <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
        Thank You!
      </h1>
      <p className="text-sm font-medium text-slate-600 mb-6">
        Your payment has been received successfully.
      </p>

      {/* Confirmation Card */}
      <div className="w-full rounded-3xl border-2 border-brand-500/30 bg-brand-50/50 p-6 shadow-sm mb-6 text-left">
        <div className="flex items-center gap-2 text-brand-800 font-bold text-sm mb-1">
          <Sparkles className="h-4 w-4 text-brand-600" />
          <span>Payment Completed</span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Your print job is now being processed.
        </p>

        {/* Reference Code Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Job Reference Code
          </span>
          <span
            id="job-reference-code-display"
            className="font-mono text-3xl font-black text-slate-950 tracking-wider"
          >
            {referenceCode}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">
            Show this code on the kiosk screen or to staff
          </p>
        </div>
      </div>

      {/* Footnote */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-8">
        <Printer className="h-4 w-4 text-brand-600 shrink-0" />
        <span>You will be notified once your print is ready.</span>
      </div>

      {/* Done Button */}
      <button
        onClick={() => setIsCompletedSession(true)}
        id="done-button"
        className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-slate-900 py-3.5 text-base font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-slate-800"
      >
        Done
      </button>
    </div>
  );
}
