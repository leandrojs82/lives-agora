import { GOOGLE_CLIENT_ID, OAUTH_SCOPES, USERINFO_URL } from '../config';

export interface AuthUser {
  name: string;
  email: string;
  picture: string;
}

const SESSION_FLAG = 'yt-live:hasSession';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const SCOPE_MISSING_MESSAGE =
  'Permissão do YouTube não concedida. Na tela do Google, marque a opção de acesso ao YouTube e continue.';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let expiresAt = 0;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;
let pendingPromise: Promise<string> | null = null;
let gisLoading: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;
/** Última tentativa veio sem o escopo do YouTube: o próximo login força a tela de consentimento. */
let needsConsent = false;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error('Falha ao carregar o Google Identity Services'));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export function initAuth(): Promise<void> {
  if (tokenClient) return Promise.resolve();
  if (initPromise) return initPromise;
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID não configurado'));
  initPromise = (async () => {
    await loadGis();
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: OAUTH_SCOPES,
      callback: (resp) => {
        const p = pending;
        pending = null;
        pendingPromise = null;
        if (resp.error) {
          p?.reject(new Error(resp.error_description ?? resp.error));
          return;
        }
        // Se signOut() já rejeitou (ou nunca houve) o pedido pendente, um
        // token chegando atrasado não deve reviver a sessão encerrada.
        if (!p) return;
        // Consentimento granular: o usuário pode ter desmarcado o YouTube.
        if (!google.accounts.oauth2.hasGrantedAllScopes(resp, YOUTUBE_SCOPE)) {
          needsConsent = true;
          google.accounts.oauth2.revoke(resp.access_token, () => {});
          p.reject(new Error(SCOPE_MISSING_MESSAGE));
          return;
        }
        needsConsent = false;
        accessToken = resp.access_token;
        expiresAt = Date.now() + Number(resp.expires_in) * 1000;
        sessionStorage.setItem(SESSION_FLAG, '1');
        p.resolve(resp.access_token);
      },
      error_callback: (err) => {
        const p = pending;
        pending = null;
        pendingPromise = null;
        p?.reject(new Error(err.message || err.type));
      },
    });
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

function requestToken(prompt: '' | 'consent' | 'select_account'): Promise<string> {
  if (!tokenClient) return Promise.reject(new Error('Auth não inicializado'));
  if (pendingPromise) return pendingPromise;
  pendingPromise = new Promise<string>((resolve, reject) => {
    pending = { resolve, reject };
    try {
      tokenClient!.requestAccessToken({ prompt });
    } catch (err) {
      pending = null;
      pendingPromise = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  return pendingPromise;
}

/** Login interativo (clique do usuário). */
export function signIn(): Promise<string> {
  return requestToken(needsConsent ? 'consent' : '');
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

export async function refreshToken(staleToken: string): Promise<string> {
  if (accessToken && accessToken !== staleToken) return accessToken;
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
  if (pending) {
    pending.reject(new Error('Sessão encerrada'));
    pending = null;
    pendingPromise = null;
  }
  if (t && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(t, () => {});
  }
}
