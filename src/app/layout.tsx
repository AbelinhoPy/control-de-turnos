import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Control de Turnos - SaaS 24/7',
  description: 'Gestión inteligente de turnos 24/7, asistencia geolocalizada y jornales para empresas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col font-sans antialiased text-slate-800 bg-slate-50">
        {children}
      </body>
    </html>
  );
}
