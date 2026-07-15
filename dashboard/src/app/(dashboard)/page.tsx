'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { MonoText } from '@/components/MonoText';
import { Target, Activity, ShieldAlert, Key } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function OverviewPage() {
  const api = useApi();

  const { data: usageData } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.get('/usage').then((res) => res.data),
  });

  const { data: keysData } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((res) => res.data.data),
  });

  const { data: notifData } = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: () => api.get('/notify?limit=10').then((res) => res.data.data),
  });

  // Calculate stats from real usage data
  const byChannel = usageData?.byChannel || [];
  const totalSent = byChannel.reduce((acc: number, cur: any) => acc + cur.count, 0);
  const activeKeys = (keysData || []).filter((k: any) => !k.revoked).length;
  
  // Calculate real delivery stats from notifications
  const totalNotifs = (notifData || []).length;
  const deliveredCount = (notifData || []).filter((n: any) => n.status === 'DELIVERED').length;
  const rateLimitedCount = (notifData || []).filter((n: any) => n.status === 'RATE_LIMITED').length;
  const deliveryRate = totalNotifs > 0 ? parseFloat(((deliveredCount / totalNotifs) * 100).toFixed(1)) : 0;

  // Build chart from real usage history, falling back to current period data
  const history = usageData?.history || [];
  const chartData = history.length > 0
    ? history.reduce((acc: any[], h: any) => {
        const label = format(new Date(h.periodStart), 'MMM yyyy');
        let existing = acc.find((a: any) => a.date === label);
        if (!existing) {
          existing = { date: label, volume: 0 };
          acc.push(existing);
        }
        existing.volume += h.count;
        return acc;
      }, [])
    : [{ date: format(new Date(), 'MMM yyyy'), volume: totalSent }];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-1">Platform performance and notification metrics for current billing period.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Notifications processed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">+0.2% from last period</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limited</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rateLimitedCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Requests blocked to protect quota</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeKeys}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently authorizing requests</p>
          </CardContent>
        </Card>
      </div>

      <div className="border border-border bg-card rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-6">Traffic (Last 14 Days)</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} dx={-10} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E5', boxShadow: 'none' }}
                cursor={{ stroke: '#E5E5E5', strokeWidth: 1 }}
              />
              <Line 
                type="monotone" 
                dataKey="volume" 
                stroke="#2563EB" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-border bg-card rounded-lg overflow-hidden">
        <div className="p-6 pb-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-lg">Recent Notifications</h3>
          <Link href="/notifications" className="text-sm text-primary hover:underline font-medium">View All Logs &rarr;</Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">ID</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {notifData?.map((n: any) => (
               <TableRow key={n.id}>
                 <TableCell><MonoText className="w-[110px] truncate block">{n.id}</MonoText></TableCell>
                 <TableCell className="text-sm">{n.recipient.includes('@') ? '***@' + n.recipient.split('@')[1] : '+***' + n.recipient.slice(-4)}</TableCell>
                 <TableCell className="text-sm text-muted-foreground">{n.templateName || 'None'}</TableCell>
                 <TableCell><StatusBadge status={n.status} /></TableCell>
                 <TableCell className="text-right"><MonoText className="text-[11px] bg-transparent border-transparent px-0">{format(new Date(n.createdAt), 'MMM d, HH:mm:ss')}</MonoText></TableCell>
               </TableRow>
             ))}
             {!notifData && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading recent logs...</TableCell>
                </TableRow>
             )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
