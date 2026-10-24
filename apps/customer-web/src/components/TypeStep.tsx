'use client';

import { Check } from 'lucide-react';
import React from 'react';

export interface TypeStepOptions {
  type: 'paper' | 'chart' | 'photo_sheet';
  size: 'a4' | 'a3' | 'a5' | 'letter' | 'legal';
  color: 'bw' | 'color';
  sides: 'single' | 'duplex';
}

interface TypeStepProps {
  options: TypeStepOptions;
  onChange: (updated: Partial<TypeStepOptions>) => void;
  onNext: () => void;
}

const TYPE_OPTIONS = [
  { value: 'paper', label: 'Paper' },
  { value: 'chart', label: 'Chart' },
  { value: 'photo_sheet', label: 'Photo Sheet' },
] as const;

const SIZE_OPTIONS = [
  { value: 'a4', label: 'A4' },
  { value: 'a3', label: 'A3' },
  { value: 'a5', label: 'A5' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
] as const;

const COLOR_OPTIONS = [
  { value: 'bw', label: 'Black & White' },
  { value: 'color', label: 'Color' },
] as const;

const SIDES_OPTIONS = [
  { value: 'single', label: 'Single Side' },
  { value: 'duplex', label: 'Front & Back' },
] as const;

export function TypeStep({ options, onChange, onNext }: TypeStepProps) {
  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Select the Type</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Choose what you want to print and the details
        </p>
      </div>

      <div className="space-y-6 mb-8">
        {/* 1. Type Group */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Paper Type
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {TYPE_OPTIONS.map((opt) => {
              const selected = options.type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ type: opt.value })}
                  className={`flex min-h-[50px] items-center justify-between rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50 text-brand-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selected && <Check className="h-4 w-4 text-brand-600 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Size Group */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Paper Size
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {SIZE_OPTIONS.map((opt) => {
              const selected = options.size === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ size: opt.value })}
                  className={`flex min-h-[48px] items-center justify-between rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50 text-brand-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selected && <Check className="h-4 w-4 text-brand-600 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Color Mode */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Color Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_OPTIONS.map((opt) => {
              const selected = options.color === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ color: opt.value })}
                  className={`flex min-h-[56px] items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50 text-brand-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        opt.value === 'bw'
                          ? 'bg-slate-800'
                          : 'bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500'
                      }`}
                    />
                    <span>{opt.label}</span>
                  </div>
                  {selected && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Sides (Single vs Duplex) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Print Sides
          </label>
          <div className="grid grid-cols-2 gap-3">
            {SIDES_OPTIONS.map((opt) => {
              const selected = options.sides === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ sides: opt.value })}
                  className={`flex min-h-[56px] items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50 text-brand-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selected && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        id="next-pages-button"
        className="mt-auto flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-slate-900 py-3.5 text-base font-bold text-white shadow-lg transition-all active:scale-95"
      >
        Next: Pages Per Sheet
      </button>
    </div>
  );
}
