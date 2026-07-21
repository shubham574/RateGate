'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Webhook, ChevronDown, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

interface WebhookDelivery {
  id: string;
  notificationId: string;
  event: string;
  url: string;
  payload: unknown;
  statusCode: number | null;
  success: boolean;
  attempt: number;
  errorMessage: string | null;
  createdAt: string;
}

// ─── Event badge styles ───────────────────────────────────────

const EVENT_STYLES: Record<string, { label: string; className: string }> = {
  NOTIFICATION_SENT: {
    label: 'notification.sent',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  NOTIFICATION_DELIVERED: {
    label: 'notification.delivered',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  NOTIFICATION_FAILED: {
    label: 'notification.failed',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  NOTIFICATION_RATE_LIMITED: {
    label: 'notification.rate_limited',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
};

function EventBadge({ event }: { event: string }) {
  const style = EVENT_STYLES[event] ?? { label: event, className: '' };
  return (
    <Badge variant="outline" className={`font-mono text-xs ${style.className}`}>
      {style.label}
    </Badge>
  );
}

function StatusBadge({ success, statusCode }: { success: boolean; statusCode: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      {success ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}
      <span
        className={`text-sm font-medium ${
          success ? 'text-green-700' : 'text-red-700'
        }`}
      >
        {statusCode ?? '—'}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function WebhooksPage() {
  const api = useApi();

  const [eventFilter, setEventFilter] = useState<string>('all');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allDeliveries, setAllDeliveries] = useState<WebhookDelivery[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const buildQuery = (c?: string) => {
    const params = new URLSearchParams();
    if (eventFilter !== 'all') params.set('event', eventFilter);
    if (successFilter !== 'all') params.set('success', successFilter);
    if (c) params.set('cursor', c);
    params.set('limit', '20');
    return params.toString() ? `?${params.toString()}` : '';
  };

  const { isLoading, isFetching, refetch } = useQuery({
    queryKey: ['webhook-deliveries', eventFilter, successFilter, cursor],
    queryFn: async () => {
      const res = await api.get(`/webhooks/deliveries${buildQuery(cursor)}`);
      const data: WebhookDelivery[] = res.data.data;
      const nc: string | null = res.data.nextCursor;

      if (!cursor) {
        // First page (or filter reset)
        setAllDeliveries(data);
      } else {
        setAllDeliveries((prev) => [...prev, ...data]);
      }
      setNextCursor(nc);
      return res.data;
    },
  });

  const handleFilterChange = () => {
    setCursor(undefined);
    setAllDeliveries([]);
    setNextCursor(null);
  };

  const handleEventFilterChange = (val: string | null) => {
    setEventFilter(val ?? 'all');
    handleFilterChange();
  };

  const handleSuccessFilterChange = (val: string | null) => {
    setSuccessFilter(val ?? 'all');
    handleFilterChange();
  };

  const handleLoadMore = () => {
    if (nextCursor) setCursor(nextCursor);
  };

  const handleRowClick = (delivery: WebhookDelivery) => {
    setSelectedDelivery(delivery);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="h-6 w-6" />
            Webhook Deliveries
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Audit log of all outgoing webhook POST attempts to your configured endpoint.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            handleFilterChange();
            refetch();
          }}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={eventFilter} onValueChange={handleEventFilterChange}>
          <SelectTrigger id="eventFilter" className="w-[220px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="NOTIFICATION_SENT">notification.sent</SelectItem>
            <SelectItem value="NOTIFICATION_DELIVERED">notification.delivered</SelectItem>
            <SelectItem value="NOTIFICATION_FAILED">notification.failed</SelectItem>
            <SelectItem value="NOTIFICATION_RATE_LIMITED">notification.rate_limited</SelectItem>
          </SelectContent>
        </Select>

        <Select value={successFilter} onValueChange={handleSuccessFilterChange}>
          <SelectTrigger id="successFilter" className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Succeeded</SelectItem>
            <SelectItem value="false">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Event</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Attempt</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Notification ID
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && !allDeliveries.length ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-5 w-36 bg-muted rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-16 bg-muted rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-8 bg-muted rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-32 bg-muted rounded" />
                  </td>
                </tr>
              ))
            ) : allDeliveries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  <Webhook className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No webhook deliveries yet</p>
                  <p className="text-xs mt-1">
                    Deliveries will appear here once webhooks are configured and notifications are sent.
                  </p>
                </td>
              </tr>
            ) : (
              allDeliveries.map((delivery) => (
                <tr
                  key={delivery.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(delivery)}
                >
                  <td className="px-4 py-3">
                    <EventBadge event={delivery.event} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge success={delivery.success} statusCode={delivery.statusCode} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">#{delivery.attempt}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-muted-foreground">
                      {delivery.notificationId.substring(0, 12)}…
                    </code>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {new Date(delivery.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Load more */}
        {nextCursor && (
          <div className="px-4 py-3 border-t border-border bg-muted/20 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleLoadMore}
              disabled={isFetching}
            >
              <ChevronDown className="h-4 w-4" />
              {isFetching ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <EventBadge event={selectedDelivery.event} />
                  <StatusBadge
                    success={selectedDelivery.success}
                    statusCode={selectedDelivery.statusCode}
                  />
                </SheetTitle>
                <SheetDescription>
                  Attempt #{selectedDelivery.attempt} ·{' '}
                  {new Date(selectedDelivery.createdAt).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Notification ID</p>
                    <code className="font-mono text-xs">{selectedDelivery.notificationId}</code>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Delivery ID</p>
                    <code className="font-mono text-xs">{selectedDelivery.id}</code>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-1">Endpoint URL</p>
                    <code className="font-mono text-xs break-all">{selectedDelivery.url}</code>
                  </div>
                </div>

                {/* Error message */}
                {selectedDelivery.errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-medium text-red-700 mb-1">Error</p>
                    <p className="text-xs text-red-600 font-mono">{selectedDelivery.errorMessage}</p>
                  </div>
                )}

                {/* Payload */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Payload
                  </p>
                  <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedDelivery.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
