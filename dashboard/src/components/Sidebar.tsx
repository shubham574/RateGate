'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Key, ShieldAlert, FileText, BarChart, Settings, BookOpen, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Rate Limit Rules', href: '/rules', icon: ShieldAlert },
  { name: 'Notifications', href: '/notifications', icon: FileText },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Usage & Billing', href: '/usage', icon: BarChart },
  { name: 'Documentation', href: '/docs', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-[240px] bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <span className="font-bold text-lg tracking-tight">RateGate.</span>
      </div>
      
      <nav className="flex-1 py-6 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors border-l-3",
                isActive 
                  ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "border-transparent text-sidebar-foreground hover:bg-gray-50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground p-2">
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
