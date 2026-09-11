import { GOOGLE_CLIENT_ID, OAUTH_SCOPES, USERINFO_URL } from '../config';

export interface AuthUser {
  name: string;
  email: string;
  picture: string;
}

const SESSION_FLAG = 'yt-live:hasSession';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let expiresAt = 0;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar o Google Identity Services'));
    document.head.appendChild(s);
  });
}

export async function initAuth(): Promise<void> {
  if (tokenClient) return;
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado');
  await loadGis();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: OAUTH_SCOPES,
    callback: (resp) => {
      const p = pending;
      pending = null;
      if (resp.error) {
        p?.reject(new Error(resp.error_description ?? resp.error));
        return;
      }
      accessToken = resp.access_token;
      expiresAt = Date.now() + Number(resp.expires_in) * 1000;
      sessionStorage.setItem(SESSION_FLAG, '1');
      p?.resolve(resp.access_token);
    },
    error_callback: (err) => {
      const p = pending;
      pending = null;
      p?.reject(new Error(err.message || err.type));
    },
  });
}

function requestToken(prompt: '' | 'consent' | 'select_account'): Promise<string> {
  if (!tokenClient) return Promise.reject(new Error('Auth não inicializado'));
  if (pending) return Promise.reject(new Error('Já existe uma solicitação de login em andamento'));
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient!.requestAccessToken({ prompt });
  });
}

/** Login interativo (clique do usuário). */
export function signIn(): Promise<string> {
  return requestToken('');
}

/** Tenta renovar sem interação ao recarregar a página. */
export async function trySilentSignIn(): Promise<string | null> {
  if (sessionStorage.getItem(SESSION_FLAG) !== '1') return null;
  try {
    return await requestToken('');
  } catch {
    sessionStorage.removeItem(SESSION_FLAG);
    return null;
  }
}

export async function getValidToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt - EXPIRY_MARGIN_MS) return accessToken;
  return requestToken('');
}

export async function refreshToken(): Promise<string> {
  accessToken = null;
  return requestToken('');
}

export async function fetchUserInfo(token: string): Promise<AuthUser> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Não foi possível obter o perfil do usuário');
  const data = (await res.json()) as { name?: string; email?: string; picture?: string };
  return { name: data.name ?? '', email: data.email ?? '', picture: data.picture ?? '' };
}

export function signOut(): void {
  const t = accessToken;
  accessToken = null;
  expiresAt = 0;
  sessionStorage.removeItem(SESSION_FLAG);
  if (t && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(t, () => {});
  }
}
