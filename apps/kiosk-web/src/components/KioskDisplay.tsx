'use client';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Pause,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { createKioskSession, fetchKioskJobs, SessionData } from '../lib/kiosk-api';

interface JobItem {
  id: string;
  referenceCode: string;
  status: string;
  size: string;
  color: string;
  copies: number;
}

export function KioskDisplay() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900);
  const [isPaused, setIsPaused] = useState(false);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [currentTime, setCurrentTime] = useState('');
  const [staffAlert, setStaffAlert] = useState<string | null>(null);

  // Hidden staff panel state
  const [tapCount, setTapCount] = useState(0);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Staff manual payment confirmation inputs
  const [manualRefCode, setManualRefCode] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualConfirmMsg, setManualConfirmMsg] = useState('');

  // Socket reference
  const socketRef = useRef<Socket | null>(null);

  // Initialize session
  const initSession = useCallback(async () => {
    try {
      setLoading(true);
      const data = await createKioskSession();
      setSession(data);
      setIsOffline(false);

      const expires = new Date(data.expiresAt).getTime();
      const diffSecs = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsRemaining(diffSecs);
    } catch (err) {
      console.error('Failed to create session:', err);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for jobs or fetch initially
  const loadJobs = useCallback(async () => {
    try {
      const jobList = await fetchKioskJobs();
      setJobs(jobList || []);
      setIsOffline(false);
    } catch {
      // offline fallback
    }
  }, []);

  // Socket.IO realtime connection & fallback
  useEffect(() => {
    initSession();
    loadJobs();

    const socketUrl = 'http://localhost:4000/kiosk';
    const timestamp = Math.floor(Date.now() / 1000);
    const socket = io(socketUrl, {
      query: {
        kioskId: 'kiosk_dev_01',
        timestamp: timestamp.toString(),
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsOffline(false);
    });

    socket.on('disconnect', () => {
      // triggers polling fallback
    });

    socket.on('job:paid', (jobData: JobItem) => {
      setJobs((prev) => {
        const filtered = prev.filter((j) => j.id !== jobData.id);
        return [jobData, ...filtered];
      });
    });

    socket.on('job:status_changed', (data: { jobId: string; status: string }) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === data.jobId ? { ...j, status: data.status } : j)),
      );
    });

    socket.on('staff:alert', (alertData: { message: string }) => {
      setStaffAlert(alertData.message);
    });

    // 20s Heartbeat
    const heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit('kiosk:heartbeat', { kioskId: 'kiosk_dev_01' });
      }
    }, 20000);

    // 5s Polling fallback
    const jobPollInterval = setInterval(loadJobs, 5000);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(jobPollInterval);
      socket.disconnect();
    };
  }, [initSession, loadJobs]);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer & auto-renewal
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          initSession();
          return 900;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [initSession]);

  // Wake Lock API
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {
        console.warn('Wake Lock request failed:', e);
      }
    };

    requestWakeLock();
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  // Handle Logo 5-tap
  const handleLogoTap = () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= 5) {
      setShowStaffModal(true);
      setTapCount(0);
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        setTapCount(0);
      }, 1500);
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsStaffAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Incorrect Staff PIN. Please try again.');
    }
  };

  const handleManualConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualConfirmMsg('');
    const matchingJob = jobs.find(
      (j) => j.referenceCode.toUpperCase() === manualRefCode.trim().toUpperCase(),
    );

    if (!matchingJob) {
      setManualConfirmMsg('No active job found with that reference code.');
      return;
    }

    const amountPaise = Math.round(parseFloat(manualAmount) * 100);
    try {
      const res = await fetch(`http://localhost:4000/api/v1/staff/payments/${matchingJob.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaise }),
      });
      const json = await res.json();
      if (res.ok) {
        setManualConfirmMsg(`Payment confirmed for #${matchingJob.referenceCode}!`);
        setManualRefCode('');
        setManualAmount('');
        loadJobs();
      } else {
        setManualConfirmMsg(json?.error?.message || 'Confirmation failed');
      }
    } catch {
      setManualConfirmMsg('Network error confirming payment.');
    }
  };

  const handleReprintJob = async (jobId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/v1/staff/jobs/${jobId}/reprint`, {
        method: 'POST',
      });
      if (res.ok) {
        setManualConfirmMsg('Job queued for reprint!');
        loadJobs();
      }
    } catch {
      setManualConfirmMsg('Failed to queue reprint.');
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div
          id="kiosk-offline-banner"
          className="bg-amber-600 px-6 py-2.5 text-center text-sm font-semibold tracking-wide text-white shadow-lg flex items-center justify-center gap-2"
        >
          <WifiOff className="h-4 w-4 animate-pulse" />
          <span>Kiosk offline. Reconnecting... (Showing last active QR code)</span>
          <button
            onClick={initSession}
            className="ml-4 rounded bg-amber-800/80 px-2.5 py-0.5 text-xs font-bold hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Staff Alert Banner */}
      {staffAlert && (
        <div className="bg-red-700 px-6 py-2.5 text-center text-sm font-bold tracking-wide text-white shadow-lg flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Staff Alert: {staffAlert}</span>
          <button
            onClick={() => setStaffAlert(null)}
            className="ml-4 rounded bg-red-900 px-2 py-0.5 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Paused Banner */}
      {isPaused && (
        <div className="bg-red-600 px-6 py-3 text-center text-lg font-bold tracking-wide text-white shadow-lg flex items-center justify-center gap-2">
          <Pause className="h-5 w-5" />
          <span>KIOSK TEMPORARILY PAUSED BY STAFF FOR MAINTENANCE</span>
        </div>
      )}

      {/* Top Header */}
      <header className="flex h-20 items-center justify-between border-b border-slate-800/80 px-10 bg-slate-900/60 backdrop-blur-md">
        <div
          id="kiosk-logo"
          onClick={handleLogoTap}
          className="flex cursor-pointer items-center gap-3.5 transition-transform active:scale-95 group"
          title="Printngo Kiosk (Tap 5 times for staff options)"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20 group-hover:bg-emerald-400">
            <Printer className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tracking-tight text-white">PRINT</span>
              <span className="text-2xl font-black tracking-tight text-emerald-400">N</span>
              <span className="text-2xl font-black tracking-tight text-white">GO</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
              Instant Self-Service Kiosk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="h-2 w-2 rounded-full bg-emerald-500 -ml-4" />
            <Wifi className="h-3.5 w-3.5 text-emerald-400 ml-1" />
            <span>Kiosk #01 &bull; Ground Floor</span>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 font-mono">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span>{currentTime || '00:00:00'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Center: Primary QR & Instruction Stage */}
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center relative">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="mb-6 max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
              Scan to Print
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-300">
              Point your smartphone camera at the QR code below to upload documents & print instantly.
            </p>
          </div>

          {/* QR Code Container */}
          <div className="relative group">
            <div className="rounded-3xl border-4 border-emerald-500/30 bg-white p-7 shadow-2xl shadow-emerald-500/15 transition-all duration-300 group-hover:border-emerald-500/60">
              {loading ? (
                <div className="flex h-72 w-72 items-center justify-center">
                  <RefreshCw className="h-10 w-10 animate-spin text-slate-700" />
                </div>
              ) : session?.qrUrl ? (
                <QRCodeSVG
                  id="kiosk-qr-code"
                  value={session.qrUrl}
                  size={280}
                  level="H"
                  includeMargin={false}
                />
              ) : (
                <div className="flex h-72 w-72 flex-col items-center justify-center text-slate-800">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-xs font-semibold">Generating QR...</p>
                </div>
              )}
            </div>

            {session?.jobReferenceCode && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900 px-4 py-1 shadow-lg text-xs font-mono font-bold text-emerald-400">
                REF: {session.jobReferenceCode}
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/80 px-5 py-2 text-sm text-slate-300">
            <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span>QR code refreshes automatically in</span>
            <span className="font-mono font-bold text-emerald-400 text-base">
              {formatCountdown(secondsRemaining)}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
            <span>&bull; PDF, JPG, PNG & DOCX</span>
            <span>&bull; Black & White / Color</span>
            <span>&bull; A4, A3, A5 & Letter</span>
            <span>&bull; GPay & PhonePe UPI</span>
          </div>
        </div>

        {/* Right Sidebar: Realtime Queue Panel */}
        <div className="w-80 border-l border-slate-800/80 bg-slate-900/30 p-6 flex flex-col backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Printer className="h-4 w-4 text-emerald-400" />
              Live Queue
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
              {jobs.length} Active
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {jobs.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-800 rounded-xl p-4">
                <Printer className="h-8 w-8 mb-2 stroke-1 opacity-50 text-slate-400" />
                <p className="text-xs font-medium">Printer is ready & waiting.</p>
                <p className="text-[11px] text-slate-400 mt-1">Paid jobs appear here in real-time.</p>
              </div>
            ) : (
              jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      #{job.referenceCode}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        job.status === 'printing'
                          ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                          : job.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {job.size.toUpperCase()} &bull; {job.color === 'bw' ? 'B&W' : 'Color'} &bull; {job.copies} copy
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800 text-[11px] text-slate-400">
            Need staff assistance? Call reception or notify ground staff.
          </div>
        </div>
      </main>

      {/* Hidden Staff Management Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Staff Management Console</h3>
              </div>
              <button
                onClick={() => {
                  setShowStaffModal(false);
                  setIsStaffAuthenticated(false);
                  setPinInput('');
                  setPinError('');
                  setManualConfirmMsg('');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!isStaffAuthenticated ? (
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <p className="text-sm text-slate-300">
                  Enter the staff security PIN to access kiosk hardware controls.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Staff PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="••••"
                      autoFocus
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-center font-mono text-xl tracking-widest text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  {pinError && <p className="mt-1 text-xs text-red-400">{pinError}</p>}
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500"
                >
                  Verify PIN
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-xl bg-slate-800/80 p-3 text-xs text-slate-300">
                  <span>Operator: <strong className="text-white">Admin</strong></span>
                  <span>Kiosk: <span className="font-mono text-emerald-400">kiosk_dev_01</span></span>
                </div>

                {/* Hardware Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-sm transition-all ${
                      isPaused
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? 'Resume Kiosk' : 'Pause Kiosk'}
                  </button>

                  <button
                    onClick={() => {
                      initSession();
                      setShowStaffModal(false);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 px-4 font-semibold text-sm text-white hover:bg-slate-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Force New QR
                  </button>
                </div>

                {/* Manual UPI Confirmation Form */}
                <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Manual UPI Payment Confirmation
                  </h4>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Verify the bank alert matches the 6-character order code before confirming.
                  </p>

                  <form onSubmit={handleManualConfirmPayment} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="REF Code (e.g. 7X9PNG)"
                        value={manualRefCode}
                        onChange={(e) => setManualRefCode(e.target.value.toUpperCase())}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        placeholder="Amount (e.g. 4.00)"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                    >
                      Confirm Payment
                    </button>
                  </form>
                  {manualConfirmMsg && (
                    <p className="mt-2 text-xs font-semibold text-emerald-400">{manualConfirmMsg}</p>
                  )}
                </div>

                {/* Active Jobs & Reprint */}
                <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Recent Kiosk Jobs
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {jobs.length === 0 ? (
                      <p className="text-xs text-slate-500">No jobs recorded today.</p>
                    ) : (
                      jobs.map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-emerald-400 mr-2">
                              #{j.referenceCode}
                            </span>
                            <span className="text-slate-400">{j.status}</span>
                          </div>
                          {(j.status === 'completed' || j.status === 'failed') && (
                            <button
                              onClick={() => handleReprintJob(j.id)}
                              className="flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-slate-600"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reprint
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <button
                    onClick={() => {
                      setIsStaffAuthenticated(false);
                      setShowStaffModal(false);
                    }}
                    className="w-full rounded-xl border border-slate-700 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    Lock Console & Exit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
