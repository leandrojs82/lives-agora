import { ytGet } from './youtubeClient';
import type { Channel } from './types';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';
import { SUBSCRIPTIONS_TTL_MS } from '../config';

interface SubscriptionsResponse {
  nextPageToken?: string;
  items: {
    snippet: {
      title: string;
      resourceId: { channelId: string };
      thumbnails?: { default?: { url: string } };
    };
  }[];
}

export async function fetchAllSubscriptions(): Promise<Channel[]> {
  const out: Channel[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = { part: 'snippet', mine: 'true', maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    const data = await ytGet<SubscriptionsResponse>('subscriptions', params);
    for (const item of data.items ?? []) {
      out.push({
        id: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? '',
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export async function getSubscriptions(force = false): Promise<Channel[]> {
  if (!force) {
    const cached = cacheGet<Channel[]>(CACHE_KEYS.subs);
    if (cached) return cached.value;
  }
  const subs = await fetchAllSubscriptions();
  cacheSet(CACHE_KEYS.subs, subs, SUBSCRIPTIONS_TTL_MS);
  return subs;
}
