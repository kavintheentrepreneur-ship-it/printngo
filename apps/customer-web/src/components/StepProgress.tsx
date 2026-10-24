import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import React from 'react';

export type StepId = 'file' | 'type' | 'pages' | 'review' | 'payment';

interface StepProgressProps {
  currentStep: StepId;
  onBack?: () => void;
  showBack?: boolean;
  isSaving?: boolean;
  saveMessage?: string;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'type', label: 'Type' },
  { id: 'pages', label: 'Pages' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
];

export function StepProgress({
  currentStep,
  onBack,
  showBack = false,
  isSaving = false,
  saveMessage = 'Saved',
}: StepProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-md">
      {/* Top Bar with Back Arrow and Logo / Status */}
      <div className="flex h-11 items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              id="back-button"
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 active:scale-95"
              aria-label="Go back to previous step"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-11 w-2" />
          )}

          <div className="flex items-center gap-1">
            <span className="text-lg font-black tracking-tight text-slate-900">PRINT</span>
            <span className="text-lg font-black tracking-tight text-brand-500">N</span>
            <span className="text-lg font-black tracking-tight text-slate-900">GO</span>
          </div>
        </div>

        {/* Autosave Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          {isSaving ? (
            <span className="flex items-center gap-1 text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
              Saving...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold transition-opacity duration-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {saveMessage}
            </span>
          )}
        </div>
      </div>

      {/* Progress Dots / Breadcrumb Bar */}
      <div className="mt-2.5 flex items-center justify-between px-2">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isDone = idx < currentIndex;

          return (
            <div key={step.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                      : isDone
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`mt-1 text-[10px] font-semibold tracking-tight ${
                    isActive ? 'text-brand-600' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-1.5 h-0.5 flex-1 transition-all ${
                    idx < currentIndex ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
