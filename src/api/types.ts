export interface Channel {
  id: string;
  title: string;
  thumbnailUrl: string;
}

export interface LiveStream {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  categoryId: string;
  language?: string;
  viewers?: number;
  startedAt: string;
  isSubscribed: boolean;
}

export interface Filters {
  categoryId: string | null;
  region: string | null;
  language: string | null;
  query: string;
}

export const EMPTY_FILTERS: Filters = {
  categoryId: null,
  region: null,
  language: null,
  query: '',
};
