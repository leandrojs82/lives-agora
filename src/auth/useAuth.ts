import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  initAuth,
  signIn as gisSignIn,
  signOut as gisSignOut,
  trySilentSignIn,
  fetchUserInfo,
  type AuthUser,
} from './googleAuth';
import { clearLiveCaches } from '../lib/cache';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const token = await trySilentSignIn();
        if (cancelled) return;
        if (token) {
          setUser(await fetchUserInfo(token));
          setStatus('signedIn');
        } else {
          setStatus('signedOut');
        }
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const token = await gisSignIn();
      setUser(await fetchUserInfo(token));
      setStatus('signedIn');
    } catch (e) {
      setError(errorMessage(e));
      setStatus('signedOut');
    }
  }, []);

  const signOut = useCallback(() => {
    gisSignOut();
    clearLiveCaches();
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  return { status, user, error, signIn, signOut };
}
