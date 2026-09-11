import { describe, it, expect, vi, afterEach } from 'vitest';
import { cacheSet, cacheGet, cacheRemove, CACHE_KEYS, clearLiveCaches } from './cache';

afterEach(() => vi.useRealTimers());

describe('cache', () => {
  it('retorna null quando não há entrada', () => {
    expect(cacheGet('x')).toBeNull();
  });

  it('salva e lê valor sem TTL', () => {
    cacheSet('k', { a: 1 });
    expect(cacheGet<{ a: number }>('k')?.value).toEqual({ a: 1 });
  });

  it('expõe savedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00Z'));
    cacheSet('k', 1);
    expect(cacheGet('k')?.savedAt).toBe(Date.parse('2026-09-11T10:00:00Z'));
  });

  it('expira quando TTL passa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00Z'));
    cacheSet('k', 'v', 1000);
    vi.setSystemTime(new Date('2026-09-11T10:00:00.999Z'));
    expect(cacheGet('k')?.value).toBe('v');
    vi.setSystemTime(new Date('2026-09-11T10:00:01.001Z'));
    expect(cacheGet('k')).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('ignora JSON corrompido', () => {
    localStorage.setItem('k', '{not json');
    expect(cacheGet('k')).toBeNull();
  });

  it('cacheRemove apaga', () => {
    cacheSet('k', 1);
    cacheRemove('k');
    expect(cacheGet('k')).toBeNull();
  });

  it('clearLiveCaches apaga só caches de lives, mantém inscrições', () => {
    cacheSet(CACHE_KEYS.subs, []);
    cacheSet(CACHE_KEYS.livesSubscribed, []);
    cacheSet(CACHE_KEYS.livesDiscover, []);
    clearLiveCaches();
    expect(cacheGet(CACHE_KEYS.subs)).not.toBeNull();
    expect(cacheGet(CACHE_KEYS.livesSubscribed)).toBeNull();
    expect(cacheGet(CACHE_KEYS.livesDiscover)).toBeNull();
  });
});
