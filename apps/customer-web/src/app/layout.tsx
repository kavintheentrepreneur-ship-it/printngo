import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Printngo - Self-Service Printing',
  description: 'Upload, customize, and print your documents instantly from any Printngo kiosk.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
