import { YT_API_BASE, QUOTA_COST, type YtResource } from '../config';
import { addQuota } from '../lib/quota';

export class QuotaExceededError extends Error {
  constructor() {
    super('Cota diária da YouTube API esgotada');
    this.name = 'QuotaExceededError';
  }
}

export class AuthError extends Error {
  constructor(message = 'Sessão expirada. Faça login novamente.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class YouTubeApiError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `YouTube API respondeu ${status}`);
    this.name = 'YouTubeApiError';
  }
}

export interface TokenProvider {
  getToken(): Promise<string>;
  refreshToken(): Promise<string>;
}

let provider: TokenProvider | null = null;

export function configureClient(p: TokenProvider | null): void {
  provider = p;
}

function doFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

interface GoogleErrorBody {
  error?: { errors?: { reason?: string }[]; message?: string };
}

export async function ytGet<T>(resource: YtResource, params: Record<string, string>): Promise<T> {
  if (!provider) throw new Error('youtubeClient não configurado');

  const url = `${YT_API_BASE}/${resource}?${new URLSearchParams(params).toString()}`;

  let token = await provider.getToken();
  let res = await doFetch(url, token);
  addQuota(QUOTA_COST[resource]);

  if (res.status === 401) {
    token = await provider.refreshToken();
    res = await doFetch(url, token);
    addQuota(QUOTA_COST[resource]);
  }

  if (res.ok) return (await res.json()) as T;

  if (res.status === 401) throw new AuthError();

  const body = (await res.json().catch(() => null)) as GoogleErrorBody | null;
  const reason = body?.error?.errors?.[0]?.reason;

  if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
    throw new QuotaExceededError();
  }

  throw new YouTubeApiError(res.status, body?.error?.message);
}
