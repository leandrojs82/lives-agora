import { useEffect, useMemo } from 'react';
import type { Filters } from '../api/types';
import { AuthError, QuotaExceededError } from '../api/youtubeClient';
import { useDiscoverLives } from '../hooks/useLives';
import { applyFilters } from '../lib/filters';
import { formatAgo } from '../lib/format';
import LiveGrid from '../components/LiveGrid';
import Banner from '../components/Banner';
import { errorToBanner } from './errorBanner';

interface Props {
  subscribedIds: Set<string>;
  filters: Filters;
  onCount: (n: number) => void;
  onAuthError: () => void;
  onQuotaExceeded: (exceeded: boolean) => void;
  onRemoteSearchRef: (fn: (() => void) | null, busy: boolean) => void;
}

export default function DiscoverTab({
  subscribedIds,
  filters,
  onCount,
  onAuthError,
  onQuotaExceeded,
  onRemoteSearchRef,
}: Props) {
  const { query: q, remoteSearch } = useDiscoverLives(subscribedIds);
  const filtered = useMemo(() => applyFilters(q.data ?? [], filters), [q.data, filters]);

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  useEffect(() => {
    onRemoteSearchRef(() => remoteSearch.mutate(filters), remoteSearch.isPending);
    return () => onRemoteSearchRef(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, remoteSearch.isPending]);

  const error = q.error ?? remoteSearch.error;
  useEffect(() => {
    if (error instanceof AuthError) onAuthError();
  }, [error, onAuthError]);
  useEffect(() => {
    onQuotaExceeded(error instanceof QuotaExceededError);
  }, [error, onQuotaExceeded]);

  const hasAny = (q.data?.length ?? 0) > 0;
  const emptyMessage = hasAny
    ? 'Nenhuma live corresponde aos filtros. Tente "Buscar no YouTube".'
    : 'Nenhuma live encontrada. Clique em "Atualizar" ou "Buscar no YouTube".';

  const banner = error ? errorToBanner(error) : null;

  return (
    <div className="space-y-3">
      {banner && <Banner kind={banner.kind}>{banner.text}</Banner>}
      {q.dataUpdatedAt > 0 && (
        <p className="text-xs text-yt-muted">
          Lives populares de canais que você não segue · atualizado {formatAgo(q.dataUpdatedAt)}
        </p>
      )}
      <LiveGrid lives={filtered} loading={q.isFetching || remoteSearch.isPending} emptyMessage={emptyMessage} />
    </div>
  );
}
