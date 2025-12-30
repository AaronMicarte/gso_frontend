'use client';

import { Toaster } from 'sonner';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>
          <TooltipProvider>
            {/* Skip to main content link for screen readers */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--primary)] focus:text-white focus:rounded-lg focus:shadow-lg"
            >
              Skip to main content
            </a>

            <Toaster
              position="top-right"
              theme="dark"
              richColors
              toastOptions={{
                style: {
                  background: '#1e293b',
                  color: '#f1f5f9',
                  border: '1px solid #334155',
                },
              }}
            />
            {children}
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
