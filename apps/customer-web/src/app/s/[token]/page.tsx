'use client';

import { AlertTriangle, Loader2, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExpiredSessionView } from '../../../components/ExpiredSessionView';
import { FileStep } from '../../../components/FileStep';
import { PagesPerSheetStep } from '../../../components/PagesPerSheetStep';
import { PaymentStep } from '../../../components/PaymentStep';
import { ReviewStep } from '../../../components/ReviewStep';
import { StepId, StepProgress } from '../../../components/StepProgress';
import { ThankYouStep } from '../../../components/ThankYouStep';
import { TypeStep, TypeStepOptions } from '../../../components/TypeStep';
import {
  CustomerSessionResponse,
  fetchCustomerSession,
  proceedToPayment,
  updateJobOptions,
} from '../../../lib/api-client';

export type ExtendedStepId = StepId | 'thank_you';

export default function CustomerFlowPage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  // Active step
  const [currentStep, setCurrentStep] = useState<ExtendedStepId>('file');

  // Session & Job State
  const [sessionData, setSessionData] = useState<CustomerSessionResponse | null>(null);
  const [pageRange, setPageRange] = useState('all');

  // Autosave states
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('Saved');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load session from API
  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage('');
      const data = await fetchCustomerSession(token);
      setSessionData(data);

      if (data.job) {
        setPageRange(data.job.pageRange || 'all');
        // Resume at appropriate step based on draft progress
        const status = data.job.status;
        if (status === 'paid' || status === 'queued' || status === 'printing' || status === 'completed') {
          setCurrentStep('thank_you');
        } else if (status === 'awaiting_payment') {
          setCurrentStep('payment');
        } else if (data.files && data.files.length > 0) {
          // Keep on file step with uploaded file ready, or resume type
        }
      }
    } catch (err: any) {
      setErrorStatus(err?.status || 500);
      setErrorMessage(
        err?.message || 'This kiosk session has ended. Please scan the new QR code on the screen.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSession();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.step) {
        setCurrentStep(e.state.step);
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [loadSession]);

  const navigateToStep = (step: ExtendedStepId) => {
    setCurrentStep(step);
    window.history.pushState({ step }, '', `#${step}`);
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'type':
        navigateToStep('file');
        break;
      case 'pages':
        navigateToStep('type');
        break;
      case 'review':
        navigateToStep('pages');
        break;
      case 'payment':
        navigateToStep('review');
        break;
      default:
        break;
    }
  };

  const handleTypeOptionsChange = (updated: Partial<TypeStepOptions>) => {
    if (!sessionData?.job) return;

    const updatedJob = {
      ...sessionData.job,
      ...updated,
    };
    setSessionData({
      ...sessionData,
      job: updatedJob,
    });

    setIsSaving(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await updateJobOptions(token, sessionData.job.id, updated);
        setSessionData((prev) =>
          prev
            ? {
                ...prev,
                job: result.job,
                priceBreakdown: result.priceBreakdown,
              }
            : null,
        );
        setSaveMessage('Saved');
      } catch (err) {
        console.error('Failed to autosave options:', err);
        setSaveMessage('Save failed');
      } finally {
        setIsSaving(false);
      }
    }, 300);
  };

  const handlePageRangeChange = async (newRange: string) => {
    setPageRange(newRange);
    if (!sessionData?.job) return;

    setIsSaving(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await updateJobOptions(token, sessionData.job.id, {
          pageRange: newRange,
        });
        setSessionData((prev) =>
          prev
            ? {
                ...prev,
                job: result.job,
                priceBreakdown: result.priceBreakdown,
              }
            : null,
        );
        setSaveMessage('Saved');
      } catch {
        setSaveMessage('Save failed');
      } finally {
        setIsSaving(false);
      }
    }, 400);
  };

  const handleCopiesChange = async (copies: number) => {
    if (!sessionData?.job) return;
    const result = await updateJobOptions(token, sessionData.job.id, { copies });
    setSessionData((prev) =>
      prev
        ? {
            ...prev,
            job: result.job,
            priceBreakdown: result.priceBreakdown,
          }
        : null,
    );
  };

  const handleProceed = async () => {
    if (!sessionData?.job) return;
    const result = await proceedToPayment(token, sessionData.job.id);
    setSessionData((prev) =>
      prev
        ? {
            ...prev,
            job: result.job,
            priceBreakdown: result.priceBreakdown,
          }
        : null,
    );
    navigateToStep('payment');
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600 mb-4" />
        <h2 className="text-base font-bold text-slate-800">Connecting to Kiosk...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving your secure printing session</p>
      </div>
    );
  }

  if (errorStatus === 410 || errorStatus === 404) {
    return <ExpiredSessionView onRetry={loadSession} message={errorMessage} />;
  }

  if (!sessionData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
        <h2 className="text-base font-bold text-slate-800">Connection Issue</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">{errorMessage || 'Unable to load session.'}</p>
        <button
          onClick={loadSession}
          className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow"
        >
          Try Again
        </button>
      </div>
    );
  }

  const primaryFile = sessionData.files?.[0] || null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-600 px-4 py-2 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          You are offline. Changes will be saved when you reconnect.
        </div>
      )}

      {/* Progress & Navigation Header (hidden on Thank You screen) */}
      {currentStep !== 'thank_you' && (
        <StepProgress
          currentStep={currentStep as StepId}
          onBack={handleBack}
          showBack={currentStep !== 'file'}
          isSaving={isSaving}
          saveMessage={saveMessage}
        />
      )}

      {/* Step Views */}
      <div className="flex flex-1 flex-col">
        {currentStep === 'file' && (
          <FileStep
            token={token}
            uploadedFile={primaryFile}
            pageRange={pageRange}
            onPageRangeChange={handlePageRangeChange}
            onFileUploaded={(newFile, newJob, breakdown) => {
              setSessionData({
                ...sessionData,
                files: [newFile],
                job: newJob,
                priceBreakdown: breakdown,
              });
              navigateToStep('type');
            }}
            onNext={() => navigateToStep('type')}
          />
        )}

        {currentStep === 'type' && (
          <TypeStep
            options={{
              type: sessionData.job.type,
              size: sessionData.job.size,
              color: sessionData.job.color,
              sides: sessionData.job.sides,
            }}
            onChange={handleTypeOptionsChange}
            onNext={() => navigateToStep('pages')}
          />
        )}

        {currentStep === 'pages' && (
          <PagesPerSheetStep
            value={sessionData.job.pagesPerSheet}
            onChange={(val) => {
              handleTypeOptionsChange({ sides: sessionData.job.sides } as any);
              updateJobOptions(token, sessionData.job.id, { pagesPerSheet: val }).then((res) => {
                setSessionData({
                  ...sessionData,
                  job: res.job,
                  priceBreakdown: res.priceBreakdown,
                });
              });
            }}
            onNext={() => navigateToStep('review')}
          />
        )}

        {currentStep === 'review' && (
          <ReviewStep
            job={sessionData.job}
            file={primaryFile}
            priceBreakdown={sessionData.priceBreakdown}
            onCopiesChange={handleCopiesChange}
            onProceed={handleProceed}
          />
        )}

        {currentStep === 'payment' && (
          <PaymentStep
            token={token}
            job={sessionData.job}
            priceFormatted={sessionData.priceBreakdown?.totalRupeesFormatted || '₹0.00'}
            onPaymentSuccess={() => {
              setSessionData({
                ...sessionData,
                job: { ...sessionData.job, status: 'paid', paymentStatus: 'captured' },
              });
              navigateToStep('thank_you');
            }}
            onCancel={() => navigateToStep('review')}
          />
        )}

        {currentStep === 'thank_you' && (
          <ThankYouStep referenceCode={sessionData.job.referenceCode} />
        )}
      </div>
    </div>
  );
}
