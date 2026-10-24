'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  QrCode,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, fetchPaymentLinks, simulatePaymentSuccess } from '../lib/api-client';

interface PaymentStepProps {
  token: string;
  job: {
    id: string;
    referenceCode: string;
    pricePaise: number;
  };
  priceFormatted: string;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

export function PaymentStep({
  token,
  job,
  priceFormatted,
  onPaymentSuccess,
  onCancel,
}: PaymentStepProps) {
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [upiData, setUpiData] = useState<{
    upiLinks: { gpay: string; phonepe: string; generic: string };
    upiId: string;
    payeeName: string;
  } | null>(null);

  const [polling, setPolling] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = useRef<number>(0);

  // Fetch per-job dynamic UPI links on load
  useEffect(() => {
    let isMounted = true;
    async function fetchLinks() {
      try {
        setLoadingLinks(true);
        const data = await fetchPaymentLinks(token, job.id);
        if (isMounted && data) {
          setUpiData(data);
        }
      } catch (err) {
        console.error('Failed to get payment links:', err);
      } finally {
        if (isMounted) setLoadingLinks(false);
      }
    }

    fetchLinks();
    return () => {
      isMounted = false;
    };
  }, [job.id, token]);

  // Polling mechanism
  const startPolling = () => {
    if (pollIntervalRef.current) return;
    setPolling(true);
    setPollingTimedOut(false);
    pollStartRef.current = Date.now();

    pollIntervalRef.current = setInterval(async () => {
      // 2 minutes timeout check
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > 120000) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setPolling(false);
        setPollingTimedOut(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/jobs/${job.id}/payment-status`, {
          headers: { 'x-session-token': token },
        });
        const json = await res.json();
        if (json.data && json.data.isPaid) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setPolling(false);
          onPaymentSuccess();
        }
      } catch {
        // network retry in polling loop
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handlePayClick = (deepLink: string) => {
    // Open UPI Intent link
    window.location.href = deepLink;
    // Immediately start polling every 3s
    startPolling();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Choose Payment</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Pay securely using Google Pay, PhonePe, or any UPI app
        </p>
      </div>

      {/* Amount Display Header Card */}
      <div className="mb-6 rounded-3xl border-2 border-brand-500/20 bg-brand-50/50 p-6 text-center shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
          Amount to Pay
        </span>
        <div className="mt-1 font-mono text-4xl font-black text-slate-900 tracking-tight">
          {priceFormatted}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-mono font-bold text-slate-700 shadow-sm border border-slate-200">
          Order REF: <span className="text-brand-700 font-black">{job.referenceCode}</span>
        </div>
      </div>

      {/* Payment Action Options */}
      {loadingLinks ? (
        <div className="flex h-48 flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-2" />
          <p className="text-xs font-semibold text-slate-500">Generating secure UPI link...</p>
        </div>
      ) : upiData ? (
        <div className="space-y-3 mb-6">
          {/* GPay Button */}
          <button
            onClick={() => handlePayClick(upiData.upiLinks.gpay)}
            id="pay-gpay-button"
            className="flex min-h-[58px] w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 shadow-sm transition-all hover:border-blue-500 hover:bg-blue-50/30 active:scale-95"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 font-black text-sm">
                G
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-slate-900">Pay with GPay</span>
                <span className="block text-[11px] text-slate-500">Google Pay UPI Intent</span>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Open App
            </span>
          </button>

          {/* PhonePe Button */}
          <button
            onClick={() => handlePayClick(upiData.upiLinks.phonepe)}
            id="pay-phonepe-button"
            className="flex min-h-[58px] w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 shadow-sm transition-all hover:border-purple-500 hover:bg-purple-50/30 active:scale-95"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 font-black text-sm">
                पे
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-slate-900">Pay with PhonePe</span>
                <span className="block text-[11px] text-slate-500">Instant UPI Direct</span>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Open App
            </span>
          </button>

          {/* Instant Test Simulator Button */}
          <button
            onClick={async () => {
              setPolling(true);
              await simulatePaymentSuccess(token, job.id);
              setTimeout(() => {
                onPaymentSuccess();
              }, 400);
            }}
            id="simulate-payment-success-button"
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800 shadow-sm transition-all hover:bg-emerald-100 active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ⚡ Test Pay / Simulate Success (Instant Demo)
          </button>
        </div>
      ) : null}

      {/* Confirming Status / Polling Banner */}
      {polling && (
        <div
          id="confirming-payment-banner"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/80 p-4 shadow-sm"
        >
          <Loader2 className="h-5 w-5 animate-spin text-brand-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-brand-900">Confirming your payment...</p>
            <p className="text-brand-700 mt-0.5">Please wait while the bank processes your transaction.</p>
          </div>
        </div>
      )}

      {/* Timeout Warning */}
      {pollingTimedOut && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold mb-0.5">Payment Confirmation Taking Longer</p>
            <p>
              We are still confirming your payment. Please wait or show your order reference code{' '}
              <strong className="font-mono text-slate-950 font-black">{job.referenceCode}</strong> to staff.
            </p>
            <button
              onClick={startPolling}
              className="mt-2 font-bold text-brand-700 underline"
            >
              Resume Checking Status
            </button>
          </div>
        </div>
      )}

      {/* UPI Fallback Card */}
      {upiData && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-slate-500" />
              Manual UPI Details (Fallback)
            </span>
            <span className="text-[10px] text-slate-400">If app doesn't open</span>
          </div>

          <p className="text-[11px] text-slate-500 mb-3">
            No UPI app found? Copy the receiving UPI ID below to pay via any banking app:
          </p>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-mono font-bold text-slate-800 select-all">
              {upiData.upiId}
            </span>
            <button
              onClick={() => copyToClipboard(upiData.upiId)}
              className="flex items-center gap-1 font-bold text-brand-700 hover:text-brand-800 p-1"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="mt-auto space-y-2.5">
        <button
          onClick={onCancel}
          disabled={polling}
          id="cancel-payment-button"
          className="flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-40"
        >
          Cancel and Return to Review
        </button>
      </div>
    </div>
  );
}
