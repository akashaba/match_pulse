import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../src/styles/globals.css';
import '../src/styles/index.css';

export const metadata: Metadata = {
  title: 'MatchPulse',
  description: 'Predict fixtures, compete in leagues, and climb the standings.',
  icons: {
    icon: '/matchpulse-icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
