import { ytGet } from './youtubeClient';
import type { LiveStream } from './types';

interface VideoItem {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    categoryId: string;
    liveBroadcastContent: 'live' | 'upcoming' | 'none';
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: {
      medium?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
  liveStreamingDetails?: {
    actualStartTime?: string;
    concurrentViewers?: string;
  };
}

interface VideosResponse {
  items?: VideoItem[];
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function mapVideo(v: VideoItem, isSubscribed: boolean): LiveStream {
  const t = v.snippet.thumbnails;
  const viewersRaw = v.liveStreamingDetails?.concurrentViewers;
  return {
    videoId: v.id,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    thumbnailUrl: t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? '',
    categoryId: v.snippet.categoryId,
    language: v.snippet.defaultAudioLanguage ?? v.snippet.defaultLanguage,
    viewers: viewersRaw !== undefined ? Number(viewersRaw) : undefined,
    startedAt: v.liveStreamingDetails?.actualStartTime ?? '',
    isSubscribed,
  };
}

/** videos.list em lotes de 50; devolve só o que está ao vivo agora. */
export async function fetchLiveVideos(
  ids: string[],
  subscribedIds: Set<string>,
): Promise<LiveStream[]> {
  const unique = [...new Set(ids)];
  const out: LiveStream[] = [];
  for (const batch of chunk(unique, 50)) {
    const data = await ytGet<VideosResponse>('videos', {
      part: 'snippet,liveStreamingDetails',
      id: batch.join(','),
      maxResults: '50',
    });
    for (const v of data.items ?? []) {
      if (v.snippet.liveBroadcastContent !== 'live') continue;
      out.push(mapVideo(v, subscribedIds.has(v.snippet.channelId)));
    }
  }
  return out;
}
