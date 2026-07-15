import { cn } from '@/lib/utils';

export function MonoText({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("font-mono text-[0.85em] bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-gray-800", className)}>
      {children}
    </span>
  );
}
