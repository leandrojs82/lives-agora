import { YT_API_BASE, QUOTA_COST, type YtResource } from '../config';
import { addQuota, addSearchCount } from '../lib/quota';

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
  refreshToken(staleToken: string): Promise<string>;
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
  error?: {
    errors?: { reason?: string }[];
    details?: { reason?: string }[];
    status?: string;
    message?: string;
  };
}

const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'RATE_LIMIT_EXCEEDED',
]);

/** Cobre o formato legado (errors[].reason) e o novo (status/details) do Google. */
export function isQuotaError(status: number, body: GoogleErrorBody | null): boolean {
  if (status !== 403 && status !== 429) return false;
  const e = body?.error;
  if (!e) return false;
  if (e.errors?.some((x) => x.reason && QUOTA_REASONS.has(x.reason))) return true;
  if (e.details?.some((x) => x.reason && QUOTA_REASONS.has(x.reason))) return true;
  if (e.status === 'RESOURCE_EXHAUSTED') return true;
  return /quota exceeded/i.test(e.message ?? '');
}

export async function ytGet<T>(resource: YtResource, params: Record<string, string>): Promise<T> {
  if (!provider) throw new Error('youtubeClient não configurado');

  const url = `${YT_API_BASE}/${resource}?${new URLSearchParams(params).toString()}`;

  let token = await provider.getToken();
  let res = await doFetch(url, token);
  addQuota(QUOTA_COST[resource]);
  if (resource === 'search') addSearchCount();

  if (res.status === 401) {
    token = await provider.refreshToken(token);
    res = await doFetch(url, token);
    addQuota(QUOTA_COST[resource]);
  }

  if (res.ok) return (await res.json()) as T;

  if (res.status === 401) throw new AuthError();

  const body = (await res.json().catch(() => null)) as GoogleErrorBody | null;
  if (isQuotaError(res.status, body)) throw new QuotaExceededError();

  throw new YouTubeApiError(res.status, body?.error?.message);
}
