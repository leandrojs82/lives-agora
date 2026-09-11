import { ytGet, YouTubeApiError } from './youtubeClient';
import { fetchLiveVideos } from './videos';
import type { Channel, LiveStream } from './types';
import { mapWithConcurrency } from '../lib/concurrency';
import { PLAYLIST_CONCURRENCY } from '../config';

interface PlaylistItemsResponse {
  items?: { contentDetails: { videoId: string } }[];
}

/** Playlist de uploads de um canal: "UC..." → "UU...". Sem chamada de API. */
export function uploadsPlaylistId(channelId: string): string {
  if (!channelId.startsWith('UC')) {
    throw new Error(`channelId fora do padrão UC: ${channelId}`);
  }
  return 'UU' + channelId.slice(2);
}

async function recentVideoIds(channelId: string): Promise<string[]> {
  try {
    const data = await ytGet<PlaylistItemsResponse>('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId(channelId),
      maxResults: '5',
    });
    return (data.items ?? []).map((i) => i.contentDetails.videoId);
  } catch (e) {
    if (e instanceof YouTubeApiError && e.status === 404) return [];
    throw e;
  }
}

export async function fetchLiveFromChannels(channels: Channel[]): Promise<LiveStream[]> {
  const idLists = await mapWithConcurrency(channels, PLAYLIST_CONCURRENCY, (c) =>
    recentVideoIds(c.id),
  );
  const subscribed = new Set(channels.map((c) => c.id));
  return fetchLiveVideos(idLists.flat(), subscribed);
}
