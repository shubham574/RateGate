'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { MonoText } from '@/components/MonoText';
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
import { Key } from 'lucide-react';

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revoked: boolean;
}

export default function ApiKeysPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((res) => res.data.data as ApiKey[]),
  });

  const createMutation = useMutation({
    mutationFn: (label: string) => api.post('/api-keys', { label }).then((res) => res.data),
    onSuccess: (data) => {
      setNewRawKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const handleCreate = () => {
    createMutation.mutate(newLabel);
    setNewLabel('');
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setNewRawKey(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground mt-1">Manage standard keys for authenticating API requests.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={isCreateOpen ? handleCloseCreate : setIsCreateOpen}>
          <DialogTrigger render={<Button>Create API Key</Button>} />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generating a new secure key to authorize API integrations.
              </DialogDescription>
            </DialogHeader>
            
            {newRawKey ? (
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <h4 className="text-sm font-semibold text-orange-800">Save This Now!</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    For security reasons, this key will <strong>not be shown again</strong>. Please copy it and store securely.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 border rounded-md flex items-center justify-between">
                  <MonoText className="text-sm max-w-[280px] break-all border-none bg-transparent px-0 py-0">{newRawKey}</MonoText>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      navigator.clipboard.writeText(newRawKey);
                      const btn = document.getElementById('copy-btn');
                      if (btn) {
                        btn.innerText = 'Copied!';
                        setTimeout(() => btn.innerText = 'Copy', 2000);
                      }
                    }}
                    id="copy-btn"
                  >
                    Copy
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseCreate}>I have saved the key</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    placeholder="e.g. Production Main Server"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Generating...' : 'Generate Key'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Label</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            )}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No API Keys found.</TableCell>
              </TableRow>
            )}
            {data?.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  {key.label}
                </TableCell>
                <TableCell>
                  <MonoText>{key.keyPrefix}•••••••••••</MonoText>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(key.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {key.lastUsedAt ? format(new Date(key.lastUsedAt), 'MMM d, yyyy HH:mm') : 'Never'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={key.revoked ? 'revoked' : 'active'} />
                </TableCell>
                <TableCell className="text-right">
                  {!key.revoked && (
                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          Revoke
                        </Button>
                      } />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately invalidate the API key &quot;{key.label}&quot;. Any integrations relying on this key will instantly fail. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => revokeMutation.mutate(key.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Yes, Revoke Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
