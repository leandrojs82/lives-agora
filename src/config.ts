export type YtResource = 'search' | 'subscriptions' | 'playlistItems' | 'videos';

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const OAUTH_SCOPES =
  'openid email profile https://www.googleapis.com/auth/youtube.readonly';
export const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
export const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const QUOTA_DAILY_LIMIT = 10_000;
export const QUOTA_COST: Record<YtResource, number> = {
  search: 100,
  subscriptions: 1,
  playlistItems: 1,
  videos: 1,
};

export const PLAYLIST_CONCURRENCY = 8;
export const SUBSCRIPTIONS_TTL_MS = 24 * 60 * 60 * 1000;
