import './globals.css';
import type { ReactNode } from 'react';
import { Space_Grotesk, Source_Sans_3 } from 'next/font/google';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display'
});

const body = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body'
});

export const metadata = {
  title: 'Online Polish Classroom',
  description: 'Professional live video classrooms powered by LiveKit.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
