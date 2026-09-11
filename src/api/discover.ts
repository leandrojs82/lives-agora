import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
import type { Filters, LiveStream } from './types';
import { EMPTY_FILTERS } from './types';
import { DISCOVER_CATEGORY_IDS } from '../lib/categories';

interface SearchResponse {
  items?: { id: { videoId?: string } }[];
}

export function buildSearchParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {
    part: 'snippet',
    eventType: 'live',
    type: 'video',
    order: 'viewCount',
    maxResults: '50',
  };
  const q = f.query.trim();
  if (q) p.q = q;
  if (f.categoryId) p.videoCategoryId = f.categoryId;
  if (f.region) p.regionCode = f.region;
  if (f.language) p.relevanceLanguage = f.language;
  return p;
}

async function searchVideoIds(params: Record<string, string>): Promise<string[]> {
  const data = await ytGet<SearchResponse>('search', params);
  return (data.items ?? []).map((i) => i.id.videoId).filter((id): id is string => !!id);
}

/** Carga inicial da aba Descoberta: 5 categorias populares (500 un.). */
export async function fetchDiscoverInitial(subscribedIds: Set<string>): Promise<LiveStream[]> {
  const ids: string[] = [];
  for (const categoryId of DISCOVER_CATEGORY_IDS) {
    ids.push(...(await searchVideoIds(buildSearchParams({ ...EMPTY_FILTERS, categoryId }))));
  }
  const lives = await fetchLiveVideos(ids, subscribedIds);
  return lives.filter((l) => !l.isSubscribed);
}

/** Botão "Buscar no YouTube": uma search.list (100 un.) com os filtros atuais. */
export async function searchLive(f: Filters, subscribedIds: Set<string>): Promise<LiveStream[]> {
  const ids = await searchVideoIds(buildSearchParams(f));
  const lives = await fetchLiveVideos(ids, subscribedIds);
  return lives.filter((l) => !l.isSubscribed);
}
