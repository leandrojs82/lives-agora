import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllSubscriptions, getSubscriptions } from './subscriptions';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

vi.mock('./youtubeClient', () => ({ ytGet: vi.fn() }));
import { ytGet } from './youtubeClient';
const ytGetMock = vi.mocked(ytGet);

function page(ids: string[], nextPageToken?: string) {
  return {
    nextPageToken,
    items: ids.map((id) => ({
      snippet: {
        title: `Canal ${id}`,
        resourceId: { channelId: id },
        thumbnails: { default: { url: `https://img/${id}.jpg` } },
      },
    })),
  };
}

beforeEach(() => ytGetMock.mockReset());

describe('fetchAllSubscriptions', () => {
  it('pagina até acabar e mapeia canais', async () => {
    ytGetMock.mockResolvedValueOnce(page(['UC1', 'UC2'], 'p2')).mockResolvedValueOnce(page(['UC3']));
    const subs = await fetchAllSubscriptions();
    expect(subs).toEqual([
      { id: 'UC1', title: 'Canal UC1', thumbnailUrl: 'https://img/UC1.jpg' },
      { id: 'UC2', title: 'Canal UC2', thumbnailUrl: 'https://img/UC2.jpg' },
      { id: 'UC3', title: 'Canal UC3', thumbnailUrl: 'https://img/UC3.jpg' },
    ]);
    expect(ytGetMock).toHaveBeenCalledTimes(2);
    expect(ytGetMock.mock.calls[0][1]).toEqual({ part: 'snippet', mine: 'true', maxResults: '50' });
    expect(ytGetMock.mock.calls[1][1]).toEqual({
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
      pageToken: 'p2',
    });
  });
});

describe('getSubscriptions', () => {
  it('usa cache quando existe', async () => {
    cacheSet(CACHE_KEYS.subs, [{ id: 'UC9', title: 'x', thumbnailUrl: '' }]);
    const subs = await getSubscriptions();
    expect(subs[0].id).toBe('UC9');
    expect(ytGetMock).not.toHaveBeenCalled();
  });

  it('busca e grava cache quando não há cache', async () => {
    ytGetMock.mockResolvedValueOnce(page(['UC1']));
    await getSubscriptions();
    expect(cacheGet(CACHE_KEYS.subs)?.value).toEqual([
      { id: 'UC1', title: 'Canal UC1', thumbnailUrl: 'https://img/UC1.jpg' },
    ]);
  });

  it('force ignora cache', async () => {
    cacheSet(CACHE_KEYS.subs, []);
    ytGetMock.mockResolvedValueOnce(page(['UC1']));
    const subs = await getSubscriptions(true);
    expect(subs).toHaveLength(1);
    expect(ytGetMock).toHaveBeenCalledTimes(1);
  });
});
