import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { env } from '@/lib/env';

// Layout for the React pages (Builder cards and /admin). The landing page is
// served separately by app/route.ts from site/index.html.
export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: 'Smartan Impact Exchange',
  description: 'Help build the new Smartan House facility, brick by brick.',
  icons: { icon: '/assets/logo-mark.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/css/app.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
