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
  armed: boolean;
  remoteError: unknown;
  onCount: (n: number) => void;
  onAuthError: () => void;
  onQuotaExceeded: (exceeded: boolean) => void;
}

export default function DiscoverTab({
  subscribedIds,
  filters,
  armed,
  remoteError,
  onCount,
  onAuthError,
  onQuotaExceeded,
}: Props) {
  const q = useDiscoverLives(subscribedIds, armed);
  const filtered = useMemo(() => applyFilters(q.data ?? [], filters), [q.data, filters]);

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  const error = q.error ?? remoteError;
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
      <LiveGrid lives={filtered} loading={q.isFetching} emptyMessage={emptyMessage} />
    </div>
  );
}
