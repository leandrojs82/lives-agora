interface Entry<T> {
  value: T;
  savedAt: number;
  ttlMs: number | null;
}

export const CACHE_KEYS = {
  subs: 'subs:v1',
  livesSubscribed: 'lives:subscribed',
  livesDiscover: 'lives:discover',
  activeTab: 'ui:activeTab',
} as const;

export function cacheSet<T>(key: string, value: T, ttlMs?: number): void {
  const entry: Entry<T> = { value, savedAt: Date.now(), ttlMs: ttlMs ?? null };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota do localStorage estourada ou storage indisponível: cache é opcional
  }
}

export function cacheGet<T>(key: string): { value: T; savedAt: number } | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let entry: Entry<T>;
  try {
    entry = JSON.parse(raw) as Entry<T>;
  } catch {
    return null;
  }
  if (entry.ttlMs !== null && Date.now() - entry.savedAt > entry.ttlMs) {
    cacheRemove(key);
    return null;
  }
  return { value: entry.value, savedAt: entry.savedAt };
}

export function cacheRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorar
  }
}

export function clearLiveCaches(): void {
  cacheRemove(CACHE_KEYS.livesSubscribed);
  cacheRemove(CACHE_KEYS.livesDiscover);
}
