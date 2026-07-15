'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { MonoText } from '@/components/MonoText';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Smartphone, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Notification {
  id: string;
  channel: 'EMAIL' | 'SMS';
  recipient: string;
  templateName: string | null;
  status: string;
  rateLimited: boolean;
  createdAt: string;
  deliveredAt: string | null;
  errorMessage?: string;
  providerMsgId?: string;
}

export default function NotificationsPage() {
  const api = useApi();
  
  // Filters
  const [status, setStatus] = useState<string>('ALL');
  const [channel, setChannel] = useState<string>('ALL');
  
  // Pagination
  const [cursorQueue, setCursorQueue] = useState<string[]>([]);
  const currentCursor = cursorQueue.length > 0 ? cursorQueue[cursorQueue.length - 1] : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', status, channel, currentCursor],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', '20');
      if (status !== 'ALL') params.append('status', status);
      if (channel !== 'ALL') params.append('channel', channel);
      if (currentCursor) params.append('cursor', currentCursor);
      
      return api.get(`/notify?${params.toString()}`).then(res => res.data);
    },
  });

  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const handleNext = () => {
    if (data?.nextCursor) {
      setCursorQueue(prev => [...prev, data.nextCursor]);
    }
  };

  const handlePrev = () => {
    setCursorQueue(prev => prev.slice(0, -1));
  };

  const rowClicked = async (n: Notification) => {
    // Fetch full details if needed, but since MVP just lists we use existing data plus call the ID endpoint
    try {
      const res = await api.get(`/notify/${n.id}`);
      setSelectedNotification({
        ...n,
        errorMessage: res.data.errorMessage,
        providerMsgId: res.data.providerMsgId,
      });
    } catch (err) {
      console.error(err);
      setSelectedNotification(n); // Fallback
    }
  };

  const maskRecipient = (rec: string, ch: string) => {
    if (ch === 'EMAIL') {
      const parts = rec.split('@');
      if (parts.length === 2 && parts[0].length > 2) {
        return `${parts[0].substring(0, 2)}***@${parts[1]}`;
      }
    } else if (ch === 'SMS') {
      return `+***${rec.slice(-4)}`;
    }
    return '***';
  };

  const copyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications Log</h2>
          <p className="text-muted-foreground mt-1 text-sm">Real-time delivery status for all outgoing messages.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={channel} onValueChange={(val) => setChannel(val || 'ALL')}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Channel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Channels</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(val) => setStatus(val || 'ALL')}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="QUEUED">Queued</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="RATE_LIMITED">Rate Limited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px]">ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Delivered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading logs...</TableCell>
                </TableRow>
              )}
              {data?.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No notifications found.</TableCell>
                </TableRow>
              )}
              {data?.data?.map((n: Notification) => (
                <TableRow 
                  key={n.id} 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => rowClicked(n)}
                >
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MonoText className="w-[100px] truncate block">{n.id}</MonoText>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => copyId(e, n.id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       {n.channel === 'EMAIL' ? <Mail className="h-4 w-4 text-gray-500" /> : <Smartphone className="h-4 w-4 text-gray-500" />}
                       <span className="text-sm font-medium">{n.channel}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{maskRecipient(n.recipient, n.channel)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{n.templateName || 'None'}</TableCell>
                  <TableCell><StatusBadge status={n.status} /></TableCell>
                  <TableCell><MonoText className="text-[11px] bg-transparent border-transparent px-0">{format(new Date(n.createdAt), 'MMM d, HH:mm:ss.SSS')}</MonoText></TableCell>
                  <TableCell>
                    {n.deliveredAt ? <MonoText className="text-[11px] bg-transparent border-transparent px-0">{format(new Date(n.deliveredAt), 'HH:mm:ss.SSS')}</MonoText> : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Footer */}
        <div className="border-t border-border p-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground px-4">
            Showing up to 20 logs
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorQueue.length === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!data?.nextCursor}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle>Notification Details</SheetTitle>
            <SheetDescription>
               ID: <MonoText className="bg-transparent border-none px-0">{selectedNotification?.id}</MonoText>
            </SheetDescription>
          </SheetHeader>
          
          {selectedNotification && (
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground">Status</div>
                <div><StatusBadge status={selectedNotification.status} /></div>
                
                <div className="text-muted-foreground">Channel</div>
                <div className="font-medium">{selectedNotification.channel}</div>

                <div className="text-muted-foreground">Created At</div>
                <div><MonoText>{format(new Date(selectedNotification.createdAt), 'MMM d, yyyy HH:mm:ss')}</MonoText></div>
                
                {selectedNotification.deliveredAt && (
                  <>
                    <div className="text-muted-foreground">Delivered At</div>
                    <div><MonoText>{format(new Date(selectedNotification.deliveredAt), 'MMM d, yyyy HH:mm:ss')}</MonoText></div>
                  </>
                )}
              </div>

              {selectedNotification.errorMessage && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h4 className="text-sm font-semibold text-destructive mb-2">Delivery Error</h4>
                  <MonoText className="text-xs bg-transparent border-none text-destructive-foreground block whitespace-pre-wrap">{selectedNotification.errorMessage}</MonoText>
                </div>
              )}
              
              {selectedNotification.rateLimited && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-orange-800 mb-2">Rate Limited</h4>
                  <p className="text-sm text-orange-700">This request was rejected because it hit a configured rate limit rule scope.</p>
                </div>
              )}

              {selectedNotification.providerMsgId && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm text-muted-foreground mb-2">Provider ID</h4>
                  <MonoText>{selectedNotification.providerMsgId}</MonoText>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
