import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSearchParams, fetchDiscoverInitial, searchLive } from './discover';
import { EMPTY_FILTERS } from './types';

vi.mock('./youtubeClient', () => ({ ytGet: vi.fn() }));
vi.mock('./videos', () => ({ fetchLiveVideos: vi.fn() }));
import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
const ytGetMock = vi.mocked(ytGet);
const fetchLiveVideosMock = vi.mocked(fetchLiveVideos);

const base = {
  part: 'snippet',
  eventType: 'live',
  type: 'video',
  order: 'viewCount',
  maxResults: '50',
};

function live(videoId: string, channelId: string, isSubscribed: boolean) {
  return {
    videoId,
    title: '',
    channelId,
    channelTitle: '',
    thumbnailUrl: '',
    categoryId: '20',
    startedAt: '',
    isSubscribed,
  };
}

beforeEach(() => {
  ytGetMock.mockReset();
  fetchLiveVideosMock.mockReset();
});

describe('buildSearchParams', () => {
  it('só base sem filtros', () => {
    expect(buildSearchParams(EMPTY_FILTERS)).toEqual(base);
  });
  it('inclui q, categoria, região, idioma', () => {
    expect(
      buildSearchParams({ query: '  xadrez ', categoryId: '20', region: 'BR', language: 'pt' }),
    ).toEqual({ ...base, q: 'xadrez', videoCategoryId: '20', regionCode: 'BR', relevanceLanguage: 'pt' });
  });
});

describe('fetchDiscoverInitial', () => {
  it('busca alvos BR/pt, US/en e global, junta ids e remove inscritos', async () => {
    ytGetMock.mockImplementation(async (_r, params) => {
      const p = params as Record<string, string>;
      return { items: [{ id: { videoId: `v-${p.regionCode ?? 'ALL'}-${p.videoCategoryId}` } }] };
    });
    fetchLiveVideosMock.mockResolvedValue([
      live('v-BR-20', 'UCsub', true),
      live('v-BR-10', 'UCx', false),
    ]);

    const out = await fetchDiscoverInitial(new Set(['UCsub']));

    expect(ytGetMock).toHaveBeenCalledTimes(8);
    const calls = ytGetMock.mock.calls.map((c) => c[1] as Record<string, string>);
    expect(calls.map((p) => [p.regionCode, p.relevanceLanguage, p.videoCategoryId])).toEqual([
      ['BR', 'pt', '20'],
      ['BR', 'pt', '10'],
      ['BR', 'pt', '25'],
      ['US', 'en', '20'],
      ['US', 'en', '10'],
      ['US', 'en', '25'],
      [undefined, undefined, '20'],
      [undefined, undefined, '10'],
    ]);
    expect(fetchLiveVideosMock.mock.calls[0][0]).toEqual([
      'v-BR-20', 'v-BR-10', 'v-BR-25', 'v-US-20', 'v-US-10', 'v-US-25', 'v-ALL-20', 'v-ALL-10',
    ]);
    expect(out.map((l) => l.videoId)).toEqual(['v-BR-10']);
  });
});

describe('searchLive', () => {
  it('uma busca com os filtros e remove inscritos', async () => {
    ytGetMock.mockResolvedValueOnce({ items: [{ id: { videoId: 'a' } }, { id: { videoId: 'b' } }] });
    fetchLiveVideosMock.mockResolvedValue([live('a', 'UCsub', true), live('b', 'UCy', false)]);

    const out = await searchLive({ ...EMPTY_FILTERS, query: 'lofi', region: 'JP' }, new Set(['UCsub']));

    expect(ytGetMock).toHaveBeenCalledTimes(1);
    expect(ytGetMock.mock.calls[0][0]).toBe('search');
    expect(ytGetMock.mock.calls[0][1]).toEqual({ ...base, q: 'lofi', regionCode: 'JP' });
    expect(out.map((l) => l.videoId)).toEqual(['b']);
  });
});
