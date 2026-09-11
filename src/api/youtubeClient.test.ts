import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  configureClient,
  ytGet,
  QuotaExceededError,
  AuthError,
  YouTubeApiError,
} from './youtubeClient';
import { getQuotaUsed } from '../lib/quota';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();
const getToken = vi.fn<() => Promise<string>>();
const refreshToken = vi.fn<(staleToken: string) => Promise<string>>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getToken.mockReset().mockResolvedValue('tok1');
  refreshToken.mockReset().mockResolvedValue('tok2');
  configureClient({ getToken, refreshToken });
});

describe('ytGet', () => {
  it('monta URL, envia Bearer e conta cota', async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));
    const out = await ytGet<{ items: unknown[] }>('videos', { part: 'snippet', id: 'a,b' });
    expect(out).toEqual({ items: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=a%2Cb');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok1');
    expect(getQuotaUsed()).toBe(1);
  });

  it('search custa 100', async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));
    await ytGet('search', { q: 'x' });
    expect(getQuotaUsed()).toBe(100);
  });

  it('em 401 renova o token e repete uma vez', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ ok: 1 }));
    const out = await ytGet('videos', {});
    expect(out).toEqual({ ok: 1 });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refreshToken).toHaveBeenCalledWith('tok1');
    const [, init2] = fetchMock.mock.calls[1];
    expect((init2!.headers as Record<string, string>).Authorization).toBe('Bearer tok2');
  });

  it('401 persistente vira AuthError', async () => {
    fetchMock.mockResolvedValue(json({}, 401));
    await expect(ytGet('videos', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('403 quotaExceeded vira QuotaExceededError', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403),
    );
    await expect(ytGet('videos', {})).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('403 por outro motivo vira YouTubeApiError', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { errors: [{ reason: 'forbidden' }] } }, 403));
    await expect(ytGet('videos', {})).rejects.toBeInstanceOf(YouTubeApiError);
  });

  it('404 vira YouTubeApiError com status', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404));
    const err = await ytGet('playlistItems', {}).catch((e) => e);
    expect(err).toBeInstanceOf(YouTubeApiError);
    expect((err as YouTubeApiError).status).toBe(404);
  });

  it('sem configureClient lança erro', async () => {
    configureClient(null);
    await expect(ytGet('videos', {})).rejects.toThrow('youtubeClient não configurado');
  });
});
