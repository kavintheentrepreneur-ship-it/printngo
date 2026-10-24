'use client';

import { Check } from 'lucide-react';
import React from 'react';

interface PagesPerSheetStepProps {
  value: 1 | 2 | 3 | 4;
  onChange: (val: 1 | 2 | 3 | 4) => void;
  onNext: () => void;
}

const LAYOUT_OPTIONS: Array<{
  value: 1 | 2 | 3 | 4;
  label: string;
  description: string;
  renderLayout: () => React.ReactNode;
}> = [
  {
    value: 1,
    label: '1 Page per Sheet',
    description: 'Print one page on each paper.',
    renderLayout: () => (
      <div className="flex h-16 w-12 items-center justify-center rounded border border-slate-300 bg-white p-1 shadow-sm">
        <div className="h-full w-full rounded bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
          1
        </div>
      </div>
    ),
  },
  {
    value: 2,
    label: '2 Pages per Sheet',
    description: 'Print two pages on each paper.',
    renderLayout: () => (
      <div className="flex h-16 w-12 flex-col gap-1 rounded border border-slate-300 bg-white p-1 shadow-sm">
        <div className="h-full w-full rounded bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
          1
        </div>
        <div className="h-full w-full rounded bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
          2
        </div>
      </div>
    ),
  },
  {
    value: 3,
    label: '3 Pages per Sheet',
    description: 'Print three pages on each paper.',
    renderLayout: () => (
      <div className="flex h-16 w-12 flex-col gap-1 rounded border border-slate-300 bg-white p-1 shadow-sm">
        <div className="flex-1 rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          1
        </div>
        <div className="flex-1 rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          2
        </div>
        <div className="flex-1 rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          3
        </div>
      </div>
    ),
  },
  {
    value: 4,
    label: '4 Pages per Sheet',
    description: 'Print four pages on each paper.',
    renderLayout: () => (
      <div className="grid h-16 w-12 grid-cols-2 gap-1 rounded border border-slate-300 bg-white p-1 shadow-sm">
        <div className="rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          1
        </div>
        <div className="rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          2
        </div>
        <div className="rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          3
        </div>
        <div className="rounded bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
          4
        </div>
      </div>
    ),
  },
];

export function PagesPerSheetStep({
  value,
  onChange,
  onNext,
}: PagesPerSheetStepProps) {
  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Select Pages Per Sheet
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Choose how many pages you want to print on one paper.
        </p>
      </div>

      {/* Options Stack */}
      <div className="space-y-3 mb-8">
        {LAYOUT_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex min-h-[76px] w-full items-center justify-between rounded-2xl border-2 p-3.5 text-left transition-all active:scale-95 ${
                selected
                  ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3.5">
                {/* Visual Thumbnail */}
                <div className="shrink-0">{opt.renderLayout()}</div>
                <div>
                  <h3
                    className={`text-sm font-bold ${
                      selected ? 'text-brand-950' : 'text-slate-800'
                    }`}
                  >
                    {opt.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                </div>
              </div>

              {selected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shrink-0 ml-2">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        id="next-review-button"
        className="mt-auto flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-slate-900 py-3.5 text-base font-bold text-white shadow-lg transition-all active:scale-95"
      >
        Next: Review Your Order
      </button>
    </div>
  );
}
