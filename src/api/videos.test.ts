import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunk, fetchLiveVideos } from './videos';

vi.mock('./youtubeClient', () => ({ ytGet: vi.fn() }));
import { ytGet } from './youtubeClient';
const ytGetMock = vi.mocked(ytGet);

function video(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    snippet: {
      title: `T ${id}`,
      channelId: 'UC1',
      channelTitle: 'Canal 1',
      categoryId: '20',
      liveBroadcastContent: 'live',
      defaultAudioLanguage: 'pt-BR',
      thumbnails: { medium: { url: `https://img/${id}/m.jpg` } },
      ...over,
    },
    liveStreamingDetails: { actualStartTime: '2026-09-11T10:00:00Z', concurrentViewers: '1234' },
  };
}

beforeEach(() => ytGetMock.mockReset());

describe('chunk', () => {
  it('divide em lotes', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe('fetchLiveVideos', () => {
  it('deduplica, faz lotes de 50 e mapeia só lives', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `v${i}`);
    ytGetMock
      .mockResolvedValueOnce({ items: [video('v0'), video('v1', { liveBroadcastContent: 'none' })] })
      .mockResolvedValueOnce({ items: [video('v55', { liveBroadcastContent: 'upcoming' })] });

    const out = await fetchLiveVideos([...ids, 'v0'], new Set(['UC1']));

    expect(ytGetMock).toHaveBeenCalledTimes(2);
    expect(ytGetMock.mock.calls[0][1]!.id.split(',')).toHaveLength(50);
    expect(ytGetMock.mock.calls[1][1]!.id.split(',')).toHaveLength(10);
    expect(ytGetMock.mock.calls[0][1]!.part).toBe('snippet,liveStreamingDetails');

    expect(out).toEqual([
      {
        videoId: 'v0',
        title: 'T v0',
        channelId: 'UC1',
        channelTitle: 'Canal 1',
        thumbnailUrl: 'https://img/v0/m.jpg',
        categoryId: '20',
        language: 'pt-BR',
        viewers: 1234,
        startedAt: '2026-09-11T10:00:00Z',
        isSubscribed: true,
      },
    ]);
  });

  it('usa defaultLanguage como fallback e marca não inscrito', async () => {
    ytGetMock.mockResolvedValueOnce({
      items: [video('a', { defaultAudioLanguage: undefined, defaultLanguage: 'en' })],
    });
    const out = await fetchLiveVideos(['a'], new Set());
    expect(out[0].language).toBe('en');
    expect(out[0].isSubscribed).toBe(false);
  });

  it('lista vazia não chama API', async () => {
    expect(await fetchLiveVideos([], new Set())).toEqual([]);
    expect(ytGetMock).not.toHaveBeenCalled();
  });
});
