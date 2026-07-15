'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ShieldAlert, Trash2 } from 'lucide-react';

interface Rule {
  id: string;
  scope: string;
  channel: string | null;
  windowSecs: number;
  maxRequests: number;
  strategy: string;
}

const formatWindow = (secs: number) => {
  if (secs === 0) return 'Immediate';
  if (secs % 86400 === 0) return `${secs / 86400} days`;
  if (secs % 3600 === 0) return `${secs / 3600} hours`;
  if (secs % 60 === 0) return `${secs / 60} minutes`;
  return `${secs} seconds`;
};

export default function RulesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  // Form State
  const [scope, setScope] = useState('API_KEY');
  const [channel, setChannel] = useState('ALL');
  const [windowVal, setWindowVal] = useState('1');
  const [windowUnit, setWindowUnit] = useState('3600'); // hours multiplier
  const [maxRequests, setMaxRequests] = useState('100');
  const [strategy, setStrategy] = useState('SLIDING_WINDOW');

  const { data, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: () => api.get('/rate-limit-rules').then((res) => res.data.rules as Rule[]),
  });

  const createMutation = useMutation({
    mutationFn: (newRule: any) => api.post('/rate-limit-rules', newRule).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setIsOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rate-limit-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const handleSubmit = () => {
    const windowSecs = parseInt(windowVal) * parseInt(windowUnit);
    createMutation.mutate({
      scope,
      channel: channel === 'ALL' ? null : channel,
      windowSecs,
      maxRequests: parseInt(maxRequests),
      strategy,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rate Limit Rules</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            This is RateGate&apos;s core differentiator. Stack multi-tiered limits to protect abuse and handle costs gracefully. The tighest rule automatically applies.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={<Button><ShieldAlert className="h-4 w-4 mr-2" /> Create Rule</Button>} />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Rate Limit Rule</DialogTitle>
              <DialogDescription>
                Define quotas that apply to specific identifiers within your tenant.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scope Level</Label>
                  <Select value={scope} onValueChange={(val) => setScope(val || 'API_KEY')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="API_KEY">Account / API Key</SelectItem>
                      <SelectItem value="TEMPLATE">Template</SelectItem>
                      <SelectItem value="RECIPIENT">Recipient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(val) => setChannel(val || 'ALL')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Channels (Global)</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2 space-y-2">
                  <Label>Quota</Label>
                  <Input type="number" value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} />
                </div>
                <div className="pb-2 text-center text-sm font-medium text-muted-foreground">reqs per</div>
                <div className="col-span-1 space-y-2">
                  <Input type="number" value={windowVal} onChange={(e) => setWindowVal(e.target.value)} />
                </div>
                <div className="col-span-1 space-y-2">
                  <Select value={windowUnit} onValueChange={(val) => setWindowUnit(val || '3600')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Secs</SelectItem>
                      <SelectItem value="60">Mins</SelectItem>
                      <SelectItem value="3600">Hours</SelectItem>
                      <SelectItem value="86400">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label>Evaluation Strategy</Label>
                <RadioGroup value={strategy} onValueChange={setStrategy} className="gap-3">
                  <div className="flex items-start space-x-3 border p-3 rounded-md has-[:checked]:border-primary has-[:checked]:bg-sidebar-accent">
                    <RadioGroupItem value="SLIDING_WINDOW" id="sliding" className="mt-1" />
                    <div>
                      <Label htmlFor="sliding" className="font-semibold block">Sliding Window Core (Recommended)</Label>
                      <p className="text-xs text-muted-foreground mt-1">Precise, rolling evaluation. Prevents boundary spikes. Ideal for Recipient and Template limits.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 border p-3 rounded-md has-[:checked]:border-primary has-[:checked]:bg-sidebar-accent">
                    <RadioGroupItem value="TOKEN_BUCKET" id="bucket" className="mt-1" />
                    <div>
                      <Label htmlFor="bucket" className="font-semibold block">Token Bucket</Label>
                      <p className="text-xs text-muted-foreground mt-1">Allows bursts of traffic up to the quota limit before throttling. Good for Global / API Key limits.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 border p-3 rounded-md has-[:checked]:border-primary has-[:checked]:bg-sidebar-accent">
                    <RadioGroupItem value="FIXED_WINDOW" id="fixed" className="mt-1" />
                    <div>
                      <Label htmlFor="fixed" className="font-semibold block">Fixed Window</Label>
                      <p className="text-xs text-muted-foreground mt-1">Simple calendar-based reset. Susceptible to double-spikes at edge boundaries.</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>Save Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Scope</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading rules...</TableCell>
              </TableRow>
            )}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <p className="text-muted-foreground mb-4">Without rules, no rate limiting is applied to your API keys!</p>
                  <Button variant="outline" onClick={() => setIsOpen(true)}>Create your first rate limit rule</Button>
                </TableCell>
              </TableRow>
            )}
            {data?.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">
                  <Badge variant="outline" className="font-mono bg-gray-50">{rule.scope}</Badge>
                </TableCell>
                <TableCell>
                  {rule.channel ? (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">{rule.channel}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">All Channels</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <strong>{rule.maxRequests}</strong> per {formatWindow(rule.windowSecs)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">{rule.strategy.replace('_', ' ')}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger render={
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    } />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this {rule.scope} rule? Rate limits for this scope will no longer apply.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(rule.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
