'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Webhook } from 'lucide-react';

export default function SettingsPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get('/tenant').then((res) => res.data),
  });

  const [orgName, setOrgName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Sync form state when tenant data loads
  useEffect(() => {
    if (tenant) {
      setOrgName(tenant.name || '');
      setWebhookUrl(tenant.webhookUrl || '');
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: (data: { name?: string; webhookUrl?: string | null }) =>
      api.patch('/tenant', data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      name: orgName,
      webhookUrl: webhookUrl || null,
    });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage tenant configuration and delivery callbacks.</p>
      </div>

      <div className="border border-border rounded-lg bg-card divide-y divide-border">
        {/* Tenant Config */}
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" /> Tenant Profile
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your core organizational details used across RateGate.
              </p>
            </div>
            {tenant && (
              <Badge variant="outline" className="bg-gray-50 font-mono text-xs">
                {tenant.id.substring(0, 8)}…
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                value={tenant?.email || ''}
                type="email"
                disabled
                className="opacity-60"
              />
              <p className="text-[11px] text-muted-foreground">Managed by your Clerk account.</p>
            </div>
          </div>

          {tenant && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
              <span>Plan: <Badge variant="secondary" className="ml-1">{tenant.plan}</Badge></span>
            </div>
          )}
        </div>

        {/* Webhooks Config */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Webhook className="h-5 w-5 text-muted-foreground" /> Delivery Webhooks
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure endpoints to receive real-time POST callbacks when notifications transition states (e.g. DELIVERED, FAILED).
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Endpoint URL</Label>
            <Input
              id="webhookUrl"
              placeholder="https://api.yourdomain.com/webhooks/rategate"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-[11px] text-muted-foreground">Payloads will be sent as JSON. Endpoints must return 2xx within 5 seconds.</p>
          </div>
          
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-medium">Subscribed Events</h4>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm border p-3 rounded-md flex-1 cursor-not-allowed opacity-60">
                <input type="checkbox" checked readOnly disabled /> message.delivered
              </label>
              <label className="flex items-center gap-2 text-sm border p-3 rounded-md flex-1 cursor-not-allowed opacity-60">
                <input type="checkbox" checked readOnly disabled /> message.failed
              </label>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50/50 flex items-center justify-between">
          {saveMutation.isSuccess && (
            <span className="text-sm text-green-600 font-medium">✓ Saved successfully</span>
          )}
          {saveMutation.isError && (
            <span className="text-sm text-destructive font-medium">Failed to save. Please try again.</span>
          )}
          {!saveMutation.isSuccess && !saveMutation.isError && <span />}
          <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
}
