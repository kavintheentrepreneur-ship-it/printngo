'use client';

import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  FileBox,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { uploadCustomerFile } from '../lib/api-client';

interface FileStepProps {
  token: string;
  uploadedFile: {
    id: string;
    originalName: string;
    sizeBytes: number;
    pageCount: number;
  } | null;
  pageRange: string;
  onPageRangeChange: (range: string) => void;
  onFileUploaded: (fileData: any, updatedJob: any, breakdown: any) => void;
  onNext: () => void;
}

export function FileStep({
  token,
  uploadedFile,
  pageRange,
  onPageRangeChange,
  onFileUploaded,
  onNext,
}: FileStepProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageRangeError, setPageRangeError] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (file: File) => {
    setErrorMessage('');
    setUploading(true);
    setUploadProgress(0);

    // Immediate 25 MB client check
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('This file is larger than 25 MB. Please upload a smaller file.');
      setUploading(false);
      return;
    }

    try {
      const result = await uploadCustomerFile(token, file, (percent) => {
        setUploadProgress(percent);
      });
      onFileUploaded(result.file, result.job, result.priceBreakdown);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Upload did not finish. Check your connection and try again.';
      setErrorMessage(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleUseSampleDocument = async () => {
    setUploading(true);
    setUploadProgress(40);
    setTimeout(() => {
      setUploadProgress(100);
      const mockFile = new File(['%PDF-1.4 demo content'], 'Printngo_Sample_Presentation.pdf', {
        type: 'application/pdf',
      });
      handleFileSelected(mockFile);
    }, 250);
  };

  const validateRange = (val: string) => {
    onPageRangeChange(val);
    setPageRangeError('');

    if (!uploadedFile || val.trim() === '' || val.toLowerCase() === 'all') {
      return;
    }

    // Basic client-side check against uploadedFile.pageCount
    const parts = val.split(',');
    for (const p of parts) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const bounds = trimmed.split('-').map((s) => parseInt(s.trim(), 10));
        if (bounds.some((n) => isNaN(n) || n < 1)) {
          setPageRangeError('Invalid page range format');
          return;
        }
        if (bounds.some((n) => n > uploadedFile.pageCount)) {
          setPageRangeError(
            `This page range does not match your file. The file has ${uploadedFile.pageCount} pages.`,
          );
          return;
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (isNaN(num) || num < 1) {
          setPageRangeError('Invalid page number');
          return;
        }
        if (num > uploadedFile.pageCount) {
          setPageRangeError(
            `This page range does not match your file. The file has ${uploadedFile.pageCount} pages.`,
          );
          return;
        }
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      {/* Title & Subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Select the File</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Choose where your file is located
        </p>
      </div>

      {/* Hidden Native File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
        }}
      />

      {/* Upload Source Cards Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Photos */}
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[96px] flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 transition-all hover:border-brand-500 hover:bg-brand-50/30 active:scale-95 disabled:opacity-50"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-2">
            <ImageIcon className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold text-slate-800">Photos</span>
          <span className="text-[11px] text-slate-500">JPG, PNG</span>
        </button>

        {/* Documents */}
        <button
          onClick={() => docInputRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[96px] flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 transition-all hover:border-brand-500 hover:bg-brand-50/30 active:scale-95 disabled:opacity-50"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-2">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold text-slate-800">Documents</span>
          <span className="text-[11px] text-slate-500">PDF, DOCX</span>
        </button>

        {/* Files */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[96px] flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 transition-all hover:border-brand-500 hover:bg-brand-50/30 active:scale-95 disabled:opacity-50"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600 mb-2">
            <FileBox className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold text-slate-800">Files</span>
          <span className="text-[11px] text-slate-500">All Supported</span>
        </button>

        {/* Drive (Placeholder / Coming soon) */}
        <div
          className="flex min-h-[96px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-4 opacity-60 cursor-not-allowed relative"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 mb-2">
            <Cloud className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold text-slate-600">Drive</span>
          <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 mt-0.5">
            Coming soon
          </span>
        </div>
      </div>

      {/* Quick Sample Document Button */}
      {!uploadedFile && !uploading && (
        <button
          type="button"
          onClick={handleUseSampleDocument}
          id="use-sample-doc-button"
          className="mb-6 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 py-2.5 px-4 text-xs font-bold text-brand-700 shadow-sm transition hover:bg-brand-100 active:scale-95"
        >
          <Sparkles className="h-4 w-4 text-brand-500" />
          Click to Load Sample 3-Page Document
        </button>
      )}

      {/* Uploading Progress Bar */}
      {uploading && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-brand-800 mb-2">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              Uploading & counting pages...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-900 mb-0.5">Upload Failed</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Uploaded File Details Badge */}
      {uploadedFile && !uploading && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/40 p-4.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                  {uploadedFile.originalName}
                </p>
                <p className="text-xs font-semibold text-emerald-700">
                  {uploadedFile.pageCount} {uploadedFile.pageCount === 1 ? 'Page' : 'Pages'} detected
                </p>
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-brand-700 underline hover:text-brand-900 p-2"
            >
              Change
            </button>
          </div>

          {/* Optional Page Range */}
          <div className="mt-4 border-t border-emerald-200/60 pt-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Page Range (Optional)
            </label>
            <input
              type="text"
              value={pageRange}
              onChange={(e) => validateRange(e.target.value)}
              placeholder="e.g. 1-5, 8 (or leave empty for all)"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none"
            />
            {pageRangeError ? (
              <p className="mt-1 text-xs font-medium text-red-600">{pageRangeError}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                Default: all {uploadedFile.pageCount} pages.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="mt-auto mb-4 rounded-xl bg-slate-100/80 p-3 text-center text-xs text-slate-500">
        🔒 Uploaded files are automatically deleted after 7 days for your privacy.
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={!uploadedFile || uploading || Boolean(pageRangeError)}
        id="next-button"
        className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-slate-900 py-3.5 text-base font-bold text-white shadow-lg transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
      >
        Next: Select Type
      </button>
    </div>
  );
}
