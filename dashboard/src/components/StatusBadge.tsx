import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'rate_limited' | 'active' | 'revoked';

export function StatusBadge({ status, className }: { status: NotificationStatus | string, className?: string }) {
  const s = status.toLowerCase();
  
  let bgClass = 'bg-[#6B6B6B] text-white hover:bg-[#6B6B6B]/80'; // queued/sent / default

  if (s === 'delivered' || s === 'active') {
    bgClass = 'bg-[#16A34A] text-white hover:bg-[#16A34A]/80';
  } else if (s === 'rate_limited') {
    bgClass = 'bg-[#D97706] text-white hover:bg-[#D97706]/80';
  } else if (s === 'failed' || s === 'revoked') {
    bgClass = 'bg-[#DC2626] text-white hover:bg-[#DC2626]/80';
  }

  const label = s.replace('_', ' ').toUpperCase();

  return (
    <Badge className={cn('font-semibold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full', bgClass, className)}>
      {label}
    </Badge>
  );
}
