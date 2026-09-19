import type { Metadata } from 'next';
import React from 'react';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'Vee-Alert | Real-Time AI Intelligence & Crisis War Room',
  description: 'Autonomous zero-lag AI media triage and crisis escalation engine for Infosys'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-rose-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
