import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadsPlaylistId, fetchLiveFromChannels } from './liveFromChannels';
import { YouTubeApiError } from './youtubeClient';

vi.mock('./youtubeClient', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./youtubeClient')>();
  return { ...orig, ytGet: vi.fn() };
});
vi.mock('./videos', () => ({ fetchLiveVideos: vi.fn() }));
import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
const ytGetMock = vi.mocked(ytGet);
const fetchLiveVideosMock = vi.mocked(fetchLiveVideos);

beforeEach(() => {
  ytGetMock.mockReset();
  fetchLiveVideosMock.mockReset().mockResolvedValue([]);
});

describe('uploadsPlaylistId', () => {
  it('troca UC por UU', () => {
    expect(uploadsPlaylistId('UCabc123')).toBe('UUabc123');
  });
  it('rejeita id fora do padrão', () => {
    expect(() => uploadsPlaylistId('HCabc')).toThrow();
  });
});

describe('fetchLiveFromChannels', () => {
  const channels = [
    { id: 'UC1', title: 'a', thumbnailUrl: '' },
    { id: 'UC2', title: 'b', thumbnailUrl: '' },
    { id: 'UC3', title: 'c', thumbnailUrl: '' },
  ];

  it('consulta uploads de cada canal e delega ids ao videos.list', async () => {
    ytGetMock.mockImplementation(async (_res, params) => {
      const p = params as Record<string, string>;
      if (p.playlistId === 'UU2') throw new YouTubeApiError(404);
      return { items: [{ contentDetails: { videoId: `${p.playlistId}-v1` } }] };
    });

    await fetchLiveFromChannels(channels);

    expect(ytGetMock).toHaveBeenCalledTimes(3);
    expect(ytGetMock.mock.calls[0][1]).toEqual({
      part: 'contentDetails',
      playlistId: 'UU1',
      maxResults: '5',
    });
    const [ids, subscribed] = fetchLiveVideosMock.mock.calls[0]!;
    expect(ids.sort()).toEqual(['UU1-v1', 'UU3-v1']);
    expect([...subscribed].sort()).toEqual(['UC1', 'UC2', 'UC3']);
  });

  it('propaga erros que não sejam 404', async () => {
    ytGetMock.mockRejectedValue(new YouTubeApiError(500));
    await expect(fetchLiveFromChannels(channels)).rejects.toBeInstanceOf(YouTubeApiError);
  });
});
