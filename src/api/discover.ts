import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
import type { Filters, LiveStream } from './types';
import { EMPTY_FILTERS } from './types';
import { DISCOVER_TARGETS, regionCodesFor } from '../lib/categories';

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
  // Continentes ("continent:XX") são expandidos em searchLive; aqui só país.
  if (f.region && /^[A-Z]{2}$/.test(f.region)) p.regionCode = f.region;
  if (f.language) p.relevanceLanguage = f.language;
  return p;
}

async function searchVideoIds(params: Record<string, string>): Promise<string[]> {
  const data = await ytGet<SearchResponse>('search', params);
  return (data.items ?? []).map((i) => i.id.videoId).filter((id): id is string => !!id);
}

/** Carga inicial da aba Descoberta: categorias × alvos regionais (100 un. por consulta). */
export async function fetchDiscoverInitial(subscribedIds: Set<string>): Promise<LiveStream[]> {
  const ids: string[] = [];
  for (const { region, language, categoryIds } of DISCOVER_TARGETS) {
    for (const categoryId of categoryIds) {
      ids.push(
        ...(await searchVideoIds(
          buildSearchParams({ ...EMPTY_FILTERS, categoryId, region, language }),
        )),
      );
    }
  }
  const lives = await fetchLiveVideos(ids, subscribedIds);
  return lives.filter((l) => !l.isSubscribed);
}

/**
 * Botão "Buscar no YouTube": uma search.list (100 un.) por país do filtro de
 * região (um continente vira vários países); sem região, uma única busca.
 */
export async function searchLive(f: Filters, subscribedIds: Set<string>): Promise<LiveStream[]> {
  const codes = regionCodesFor(f.region);
  const regions: (string | null)[] = codes.length ? codes : [null];
  const ids: string[] = [];
  for (const region of regions) {
    ids.push(...(await searchVideoIds(buildSearchParams({ ...f, region }))));
  }
  const lives = await fetchLiveVideos(ids, subscribedIds);
  return lives.filter((l) => !l.isSubscribed);
}
