'use client';

import {
  FileText,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';

interface ReviewStepProps {
  job: {
    id: string;
    referenceCode: string;
    pageRange: string;
    type: string;
    size: string;
    color: string;
    sides: string;
    pagesPerSheet: number;
    pageCount: number;
    copies: number;
    pricePaise: number;
  };
  file: {
    originalName: string;
    sizeBytes: number;
    pageCount: number;
  } | null;
  priceBreakdown: {
    billableSheets: number;
    basePricePerSheetPaise: number;
    copies: number;
    totalPaise: number;
    totalRupeesFormatted: string;
    isPlaceholder: boolean;
  } | null;
  onCopiesChange: (copies: number) => Promise<void>;
  onProceed: () => Promise<void>;
}

export function ReviewStep({
  job,
  file,
  priceBreakdown,
  onCopiesChange,
  onProceed,
}: ReviewStepProps) {
  const [updatingCopies, setUpdatingCopies] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [proceedError, setProceedError] = useState('');

  const handleCopiesStep = async (delta: number) => {
    const nextCopies = Math.min(20, Math.max(1, job.copies + delta));
    if (nextCopies === job.copies || updatingCopies) return;

    setUpdatingCopies(true);
    try {
      await onCopiesChange(nextCopies);
    } finally {
      setUpdatingCopies(false);
    }
  };

  const handleProceedClick = async () => {
    setProceeding(true);
    setProceedError('');
    try {
      await onProceed();
    } catch (err: unknown) {
      setProceedError(
        err instanceof Error ? err.message : 'Unable to proceed. Please try again.',
      );
      setProceeding(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      {/* Title */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Review Your Order</h1>
        <p className="text-sm font-medium text-slate-500 mt-0.5">
          Verify print options & review live pricing before paying
        </p>
      </div>

      {/* Main Order Card */}
      <div className="space-y-4 mb-6">
        {/* File Info Header Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {file?.originalName || 'Document'}
              </h2>
              <p className="text-xs text-slate-500">
                {job.pageCount} {job.pageCount === 1 ? 'page' : 'pages'} &bull;{' '}
                {formatFileSize(file?.sizeBytes)} &bull; Range:{' '}
                <span className="font-semibold text-slate-700">{job.pageRange}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Options Breakdown Grid */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
            <span className="text-slate-500">Paper Type & Size</span>
            <span className="font-bold text-slate-800 uppercase">
              {job.type.replace('_', ' ')} &bull; {job.size}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
            <span className="text-slate-500">Color Mode</span>
            <span className="font-bold text-slate-800">
              {job.color === 'bw' ? 'Black & White' : 'Color'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
            <span className="text-slate-500">Sides</span>
            <span className="font-bold text-slate-800">
              {job.sides === 'single' ? 'Single Sided' : 'Front & Back (Duplex)'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
            <span className="text-slate-500">Pages per Sheet</span>
            <span className="font-bold text-slate-800">
              {job.pagesPerSheet} {job.pagesPerSheet === 1 ? 'Page' : 'Pages'} / Sheet
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Sheets Needed per Copy</span>
            <span className="font-bold text-brand-700">
              {priceBreakdown?.billableSheets || 1} Sheets
            </span>
          </div>
        </div>

        {/* Copies Stepper Card */}
        <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Number of Copies</h3>
            <p className="text-xs text-slate-400">Max 20 copies per job</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="copies-decrement"
              onClick={() => handleCopiesStep(-1)}
              disabled={job.copies <= 1 || updatingCopies || proceeding}
              className="flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-700 transition-all active:scale-95 disabled:opacity-40"
              aria-label="Decrease copies"
            >
              <Minus className="h-4 w-4" />
            </button>

            <span className="min-w-[28px] text-center font-mono text-lg font-bold text-slate-900">
              {updatingCopies ? (
                <Loader2 className="inline h-4 w-4 animate-spin text-brand-600" />
              ) : (
                job.copies
              )}
            </span>

            <button
              type="button"
              id="copies-increment"
              onClick={() => handleCopiesStep(1)}
              disabled={job.copies >= 20 || updatingCopies || proceeding}
              className="flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-700 transition-all active:scale-95 disabled:opacity-40"
              aria-label="Increase copies"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Price Card */}
        <div className="rounded-2xl border-2 border-brand-500/30 bg-brand-50/40 p-4.5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
                Total Price
              </span>
              <p className="text-[11px] text-brand-700 mt-0.5">
                Calculated live &bull; Inclusive of all taxes
              </p>
            </div>
            <div className="text-right">
              {updatingCopies ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  <span className="text-sm font-semibold text-brand-700">Updating...</span>
                </div>
              ) : (
                <span
                  id="total-price-text"
                  className="font-mono text-3xl font-black text-brand-900 tracking-tight"
                >
                  {priceBreakdown?.totalRupeesFormatted || '₹0.00'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {proceedError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {proceedError}
        </div>
      )}

      {/* Proceed to Print Button */}
      <button
        onClick={handleProceedClick}
        disabled={updatingCopies || proceeding}
        id="proceed-button"
        className="mt-auto flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-500 active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
      >
        {proceeding ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Locking Price & Preparing Payment...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Proceed to Print ({priceBreakdown?.totalRupeesFormatted || '₹0.00'})
          </>
        )}
      </button>
    </div>
  );
}
