import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Girlfriend 💕 (she keeps NO secrets)',
  description: 'A clingy anime waifu who really, really wants to know your darkest secrets.',
  robots: 'noindex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
