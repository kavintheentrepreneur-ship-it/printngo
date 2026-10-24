'use client';

import {
  Printer,
  QrCode,
  Monitor,
  ArrowRight,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerLandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-5 bg-gradient-to-b from-slate-50 to-slate-100/80">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/60 border border-slate-100 flex flex-col items-center">
        {/* Logo Badge */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-xl shadow-brand-500/25 mb-4">
          <Printer className="h-8 w-8 stroke-[2.5]" />
        </div>

        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-3xl font-black tracking-tight text-slate-900">PRINT</span>
          <span className="text-3xl font-black tracking-tight text-brand-500">N</span>
          <span className="text-3xl font-black tracking-tight text-slate-900">GO</span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-0.5 text-xs font-bold text-emerald-700 mb-5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Kiosk System Ready
        </div>

        <p className="text-sm font-medium text-slate-500 text-center mb-6 leading-relaxed max-w-xs">
          QR-code-driven self-service printing kiosk. Scan, upload, customize, and print in seconds.
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <Link
            href="/s/demo"
            id="start-customer-app-button"
            className="flex items-center justify-between gap-3 w-full py-4 px-5 rounded-2xl bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 hover:bg-brand-600 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="block font-black leading-tight">Mobile Customer App</span>
                <span className="block text-[11px] font-normal text-white/80">
                  Full 5-step print ordering flow
                </span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/90" />
          </Link>

          <Link
            href="/kiosk"
            target="_blank"
            id="open-kiosk-screen-button"
            className="flex items-center justify-between gap-3 w-full py-4 px-5 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-md hover:bg-slate-800 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-brand-400">
                <Monitor className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="block font-black leading-tight">Kiosk Screen (Screen 2)</span>
                <span className="block text-[11px] font-normal text-slate-400">
                  Fullscreen QR display & queue
                </span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        </div>

        {/* Feature Highlights Card */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 w-full flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Zap className="h-4 w-4 text-brand-500 shrink-0" />
            <span>Interactive Demo Ready</span>
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Click <strong>Mobile Customer App</strong> above to test uploading files, live N-up sheet layouts, live price recalculations, and one-tap test payment simulation with confetti celebration!
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
          <span>Strict integer paise pricing & HMAC security enabled</span>
        </div>
      </div>
    </div>
  );
}
