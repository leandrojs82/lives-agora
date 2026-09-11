import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSubscriptions } from '../api/subscriptions';
import { fetchLiveFromChannels } from '../api/liveFromChannels';
import { fetchDiscoverInitial, searchLive } from '../api/discover';
import type { Channel, Filters, LiveStream } from '../api/types';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

export const QK = {
  subscriptions: ['subscriptions'] as const,
  subscribed: ['lives', 'subscribed'] as const,
  discover: ['lives', 'discover'] as const,
};

function cachedLives(key: string): { value: LiveStream[]; savedAt: number } | undefined {
  return cacheGet<LiveStream[]>(key) ?? undefined;
}

export function useSubscriptions() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QK.subscriptions,
    queryFn: () => getSubscriptions(),
  });
  const reload = async () => {
    const subs = await getSubscriptions(true);
    qc.setQueryData(QK.subscriptions, subs);
  };
  return { ...query, reload };
}

export function useSubscribedLives(channels: Channel[] | undefined, armed: boolean) {
  const cached = cachedLives(CACHE_KEYS.livesSubscribed);
  return useQuery({
    queryKey: QK.subscribed,
    enabled: !!channels && armed,
    initialData: cached?.value,
    initialDataUpdatedAt: cached?.savedAt,
    queryFn: async () => {
      const lives = await fetchLiveFromChannels(channels ?? []);
      cacheSet(CACHE_KEYS.livesSubscribed, lives);
      return lives;
    },
  });
}

export function useDiscoverLives(subscribedIds: Set<string> | undefined, armed: boolean) {
  const cached = cachedLives(CACHE_KEYS.livesDiscover);

  return useQuery({
    queryKey: QK.discover,
    enabled: !!subscribedIds && armed,
    initialData: cached?.value,
    initialDataUpdatedAt: cached?.savedAt,
    queryFn: async () => {
      const lives = await fetchDiscoverInitial(subscribedIds ?? new Set());
      cacheSet(CACHE_KEYS.livesDiscover, lives);
      return lives;
    },
  });
}

export function useRemoteSearch(subscribedIds: Set<string> | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filters: Filters) => searchLive(filters, subscribedIds ?? new Set()),
    onSuccess: (lives) => {
      cacheSet(CACHE_KEYS.livesDiscover, lives);
      qc.setQueryData(QK.discover, lives);
    },
  });
}
