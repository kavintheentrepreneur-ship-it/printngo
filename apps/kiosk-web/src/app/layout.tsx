import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Printngo Kiosk',
  description: 'Self-service QR-code printing kiosk display',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="h-full w-full overflow-hidden select-none bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
