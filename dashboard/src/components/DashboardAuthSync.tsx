'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { useUser } from '@clerk/nextjs';

export function DashboardAuthSync({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const { isLoaded, user } = useUser();
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    if (!synced) {
      api.post('/auth/sync', {
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
      })
      .then(() => setSynced(true))
      .catch((err) => {
        console.error('Failed to sync tenant', err);
        setError('Failed to initialize workspace. Please try refreshing.');
      });
    }
  }, [api, isLoaded, user, synced]);

  if (error) {
    return <div className="p-8 text-destructive max-w-lg mx-auto mt-20 border rounded shadow-sm">{error}</div>;
  }

  if (!synced) {
    return <div className="p-8 text-center text-muted-foreground">Initializing Workspace...</div>;
  }

  return <>{children}</>;
}
