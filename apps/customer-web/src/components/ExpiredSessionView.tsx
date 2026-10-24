'use client';

import { Clock, QrCode, RefreshCw } from 'lucide-react';
import React from 'react';

interface ExpiredSessionViewProps {
  onRetry: () => void;
  message?: string;
}

export function ExpiredSessionView({
  onRetry,
  message = 'This kiosk session has ended. Please scan the new QR code on the screen.',
}: ExpiredSessionViewProps) {
  return (
    <div className="flex min-h-[500px] flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 shadow-lg shadow-amber-500/10 mb-6">
        <Clock className="h-10 w-10 stroke-[2.2]" />
      </div>

      <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
        Session Expired
      </h1>

      <p className="max-w-xs text-sm font-medium text-slate-600 leading-relaxed mb-8">
        {message}
      </p>

      <div className="w-full space-y-3">
        <button
          onClick={onRetry}
          id="retry-session-button"
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-slate-800 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Check Session Again
        </button>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 pt-2">
          <QrCode className="h-4 w-4 text-brand-600" />
          <span>Look at the kiosk display for the new QR code</span>
        </div>
      </div>
    </div>
  );
}
