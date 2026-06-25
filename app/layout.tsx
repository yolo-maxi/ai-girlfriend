import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Girlfriend 💕 (rizz check)',
  description: "attestWaifu, the first ai girlfriend that won't cheat on you by sharing your data",
  robots: 'noindex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
