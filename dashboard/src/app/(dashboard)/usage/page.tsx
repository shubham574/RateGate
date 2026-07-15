'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function UsagePage() {
  const api = useApi();

  const { data: usageData, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.get('/usage').then((res) => res.data),
  });

  const byChannel = usageData?.byChannel || [];
  const emailEntry = byChannel.find((d: any) => d.channel === 'EMAIL');
  const smsEntry = byChannel.find((d: any) => d.channel === 'SMS');

  const emailCount = emailEntry?.count || 0;
  const smsCount = smsEntry?.count || 0;
  const EMAIL_LIMIT = emailEntry?.limit || 50000;
  const SMS_LIMIT = smsEntry?.limit || 1000;

  const emailPct = EMAIL_LIMIT > 0 ? Math.min((emailCount / EMAIL_LIMIT) * 100, 100) : 0;
  const smsPct = SMS_LIMIT > 0 ? Math.min((smsCount / SMS_LIMIT) * 100, 100) : 0;

  // Build chart from real history data
  const history = usageData?.history || [];
  const chartData = history.length > 0
    ? history.reduce((acc: any[], h: any) => {
        const label = format(new Date(h.periodStart), 'MMM yyyy');
        let existing = acc.find((a: any) => a.name === label);
        if (!existing) {
          existing = { name: label, email: 0, sms: 0 };
          acc.push(existing);
        }
        if (h.channel === 'EMAIL') existing.email += h.count;
        if (h.channel === 'SMS') existing.sms += h.count;
        return acc;
      }, [])
    : [{ name: format(new Date(), "MMM yyyy '(Current)'"), email: emailCount, sms: smsCount }];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usage & Billing</h2>
        <p className="text-muted-foreground mt-1">Monitor your notification volume against plan limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Email Card */}
        <div className="border border-border bg-card rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Email Usage</h3>
              <Badge variant="outline">Current Period</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-3xl font-bold">{emailCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mb-1">/ {EMAIL_LIMIT.toLocaleString()}</div>
            </div>
            <Progress value={emailPct} className="mt-4 h-2 bg-gray-100" />
            <p className="text-xs text-muted-foreground mt-3">
              {emailPct.toFixed(1)}% of free tier limit reached
            </p>
          </div>
        </div>

        {/* SMS Card */}
        <div className="border border-border bg-card rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">SMS Usage</h3>
              <Badge variant="outline">Current Period</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-3xl font-bold">{smsCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mb-1">/ {SMS_LIMIT.toLocaleString()}</div>
            </div>
            <Progress value={smsPct} className="mt-4 h-2 bg-gray-100 [&>div]:bg-blue-500" />
            <p className="text-xs text-muted-foreground mt-3">
              {smsPct.toFixed(1)}% of free tier limit reached
            </p>
          </div>
        </div>

        {/* Plan Card */}
        <div className="border border-border bg-card rounded-lg p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 -mr-2 -mt-2 opacity-5">
            <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2L2 7l9 5 9-5-9-5zm0 7.5L3.5 6 11 2.5 18.5 6 11 9.5zm0 3L2 7.5l9 5 9-5-9 5z"/></svg>
          </div>
          <div className="relative">
            <h3 className="font-semibold text-lg">Current Plan</h3>
            <div className="mt-4">
              <span className="text-3xl font-bold">FREE</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Renews on Aug 1, 2026
            </p>
            <div className="mt-6">
              <Button className="w-full">Upgrade Plan</Button>
            </div>
          </div>
        </div>

      </div>

      {/* Bar Chart */}
      <div className="border border-border bg-card rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-6">Historical Volume</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip 
                cursor={{ fill: '#FAFAFA' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E5', boxShadow: 'none' }}
              />
              <Bar dataKey="email" name="Email" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="sms" name="SMS" fill="#6B7280" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
