import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Girlfriend 💕 (rizz check)',
  description: 'A playful anime waifu flirting game where you charm past her defenses.',
  robots: 'noindex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
