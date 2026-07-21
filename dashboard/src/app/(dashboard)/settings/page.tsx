'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Shield,
  Webhook,
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';

export default function SettingsPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get('/tenant').then((res) => res.data),
  });

  const [orgName, setOrgName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    error?: string;
    latencyMs: number;
  } | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [regeneratedSecret, setRegeneratedSecret] = useState<string | null>(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (tenant) {
      setOrgName(tenant.name || '');
      setWebhookUrl(tenant.webhookUrl || '');
    }
  }, [tenant]);

  // Reset test result when URL changes
  useEffect(() => {
    setTestResult(null);
  }, [webhookUrl]);

  const saveMutation = useMutation({
    mutationFn: (data: { name?: string; webhookUrl?: string | null }) =>
      api.patch('/tenant', data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      api.post('/tenant/webhook-secret/regenerate').then((res) => res.data),
    onSuccess: (data) => {
      setRegeneratedSecret(data.webhookSecret);
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });

  const handleSave = () => {
    setTestResult(null);
    saveMutation.mutate({ name: orgName, webhookUrl: webhookUrl || null });
  };

  const handleTestWebhook = async () => {
    setIsTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.post('/webhooks/test');
      setTestResult(res.data);
    } catch (err: any) {
      const data = err?.response?.data;
      setTestResult({
        success: false,
        statusCode: data?.statusCode,
        error: data?.error ?? err?.message ?? 'Request failed',
        latencyMs: 0,
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (regeneratedSecret) {
      navigator.clipboard.writeText(regeneratedSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  const handleRegenerateConfirm = () => {
    regenerateMutation.mutate();
  };

  const handleRegenerateDialogChange = (open: boolean) => {
    setRegenerateDialogOpen(open);
    if (!open) {
      // Close dialog — clear the shown secret so it can't be retrieved again
      setRegeneratedSecret(null);
      setSecretCopied(false);
      regenerateMutation.reset();
    }
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
              <span>
                Plan: <Badge variant="secondary" className="ml-1">{tenant.plan}</Badge>
              </span>
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
              Configure endpoints to receive real-time POST callbacks when notifications change status.
            </p>
          </div>

          {/* Endpoint URL + Test button */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Endpoint URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhookUrl"
                placeholder="https://api.yourdomain.com/webhooks/rategate"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                id="sendTestWebhookBtn"
                variant="outline"
                size="default"
                onClick={handleTestWebhook}
                disabled={isTestLoading || !webhookUrl || isLoading}
                className="shrink-0 gap-2"
              >
                <Send className="h-4 w-4" />
                {isTestLoading ? 'Sending…' : 'Send test'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Payloads are signed with HMAC-SHA256. Endpoints must return 2xx within 5 seconds.
            </p>

            {/* Test result toast */}
            {testResult && (
              <div
                className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                  testResult.success
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                )}
                <div>
                  {testResult.success ? (
                    <span>
                      <strong>Success</strong> — HTTP {testResult.statusCode} in {testResult.latencyMs}ms
                    </span>
                  ) : (
                    <span>
                      <strong>Failed</strong>
                      {testResult.statusCode ? ` — HTTP ${testResult.statusCode}` : ''}{' '}
                      {testResult.error && `(${testResult.error})`}
                      {testResult.latencyMs > 0 && ` · ${testResult.latencyMs}ms`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Webhook Secret section */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between pt-4">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Webhook Secret
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Used to sign webhook payloads with HMAC-SHA256. Verify using{' '}
                  <code className="font-mono bg-muted px-1 rounded">X-RateGate-Signature</code>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {tenant?.hasWebhookSecret ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 gap-1.5"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Secret configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground gap-1.5">
                    <XCircle className="h-3 w-3" />
                    No secret yet
                  </Badge>
                )}

                {/* Regenerate dialog */}
                <Dialog open={regenerateDialogOpen} onOpenChange={handleRegenerateDialogChange}>
                  <DialogTrigger asChild>
                    <Button
                      id="regenerateSecretBtn"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={isLoading}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {tenant?.hasWebhookSecret ? 'Regenerate' : 'Generate secret'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    {!regenerateMutation.isSuccess ? (
                      <>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {tenant?.hasWebhookSecret ? 'Regenerate webhook secret?' : 'Generate webhook secret?'}
                          </DialogTitle>
                          <DialogDescription className="space-y-2 pt-1 text-left">
                            {tenant?.hasWebhookSecret ? (
                              <>
                                <p>
                                  This will <strong>immediately invalidate</strong> your current secret.
                                  Any existing signature verification code on your end will start
                                  rejecting webhooks the moment you rotate — until you update it with
                                  the new secret.
                                </p>
                                <p className="text-amber-700 font-medium text-sm">
                                  Do not rotate unless you are ready to deploy updated verification
                                  code to your webhook receiver at the same time.
                                </p>
                              </>
                            ) : (
                              <p>
                                A new signing secret will be generated. Copy it immediately after
                                creation — it will not be shown again.
                              </p>
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button
                            variant="outline"
                            onClick={() => setRegenerateDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            id="confirmRegenerateBtn"
                            variant="destructive"
                            onClick={handleRegenerateConfirm}
                            disabled={regenerateMutation.isPending}
                          >
                            {regenerateMutation.isPending ? 'Regenerating…' : 'Yes, regenerate'}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : (
                      /* Show secret ONCE after successful regeneration */
                      <>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Secret generated
                          </DialogTitle>
                          <DialogDescription className="text-left pt-1">
                            Copy this secret now. It will not be shown again after you close this dialog.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
                            <code
                              id="newWebhookSecret"
                              className="flex-1 font-mono text-xs break-all text-foreground"
                            >
                              {regeneratedSecret}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={handleCopySecret}
                            >
                              {secretCopied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Use this value in your webhook receiver to verify the{' '}
                            <code className="font-mono bg-muted px-1 rounded">X-RateGate-Signature</code>{' '}
                            header via <code className="font-mono bg-muted px-1 rounded">crypto.timingSafeEqual</code>.
                          </p>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => setRegenerateDialogOpen(false)}>
                            Done — I've copied the secret
                          </Button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Subscribed Events */}
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-medium">Subscribed Events</h4>
            <div className="grid grid-cols-2 gap-3">
              {['notification.sent', 'notification.failed', 'notification.delivered', 'notification.rate_limited'].map(
                (ev) => (
                  <label
                    key={ev}
                    className="flex items-center gap-2 text-sm border p-3 rounded-md cursor-not-allowed opacity-60"
                  >
                    <input type="checkbox" checked readOnly disabled />
                    <code className="font-mono text-xs">{ev}</code>
                  </label>
                )
              )}
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
