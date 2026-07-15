import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { DashboardAuthSync } from '@/components/DashboardAuthSync';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-[240px] flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 w-full max-w-[1200px] mx-auto p-8">
          <DashboardAuthSync>
            {children}
          </DashboardAuthSync>
        </main>
      </div>
    </div>
  );
}
