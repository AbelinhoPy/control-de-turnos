import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'ADMIN') {
    redirect('/funcionario');
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AdminSidebar
        userName={session.name}
        userEmail={session.email}
        orgName={session.organizationName}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        {children}
      </main>
    </div>
  );
}
