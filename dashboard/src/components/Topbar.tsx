'use client';

import { UserButton } from '@clerk/nextjs';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';

export function Topbar() {
  const pathname = usePathname();
  
  let title = 'Overview';
  if (pathname.includes('/api-keys')) title = 'API Keys';
  else if (pathname.includes('/rules')) title = 'Rate Limit Rules';
  else if (pathname.includes('/notifications')) title = 'Notifications Log';
  else if (pathname.includes('/usage')) title = 'Usage & Billing';
  else if (pathname.includes('/settings')) title = 'Settings';

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
          FREE PLAN
        </Badge>
        <UserButton />
      </div>
    </header>
  );
}
