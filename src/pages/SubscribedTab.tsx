import { useEffect, useMemo } from 'react';
import type { Channel, Filters } from '../api/types';
import { AuthError, QuotaExceededError } from '../api/youtubeClient';
import { useSubscribedLives } from '../hooks/useLives';
import { applyFilters } from '../lib/filters';
import { formatAgo } from '../lib/format';
import LiveGrid from '../components/LiveGrid';
import Banner from '../components/Banner';
import { errorToBanner } from './errorBanner';

interface Props {
  channels: Channel[];
  filters: Filters;
  armed: boolean;
  onCount: (n: number) => void;
  onAuthError: () => void;
  onQuotaExceeded: (exceeded: boolean) => void;
}

export default function SubscribedTab({ channels, filters, armed, onCount, onAuthError, onQuotaExceeded }: Props) {
  const q = useSubscribedLives(channels, armed);
  const filtered = useMemo(() => applyFilters(q.data ?? [], filters), [q.data, filters]);

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);
  useEffect(() => {
    if (q.error instanceof AuthError) onAuthError();
  }, [q.error, onAuthError]);
  useEffect(() => {
    onQuotaExceeded(q.error instanceof QuotaExceededError);
  }, [q.error, onQuotaExceeded]);

  const hasAny = (q.data?.length ?? 0) > 0;
  const emptyMessage = hasAny
    ? 'Nenhuma live corresponde aos filtros.'
    : q.data
      ? 'Nenhum canal inscrito está ao vivo agora.'
      : 'Clique em "Atualizar" para buscar as lives dos seus canais.';

  const banner = q.error ? errorToBanner(q.error) : null;

  return (
    <div className="space-y-3">
      {banner && <Banner kind={banner.kind}>{banner.text}</Banner>}
      {q.dataUpdatedAt > 0 && (
        <p className="text-xs text-yt-muted">
          {channels.length} canais inscritos · atualizado {formatAgo(q.dataUpdatedAt)}
        </p>
      )}
      <LiveGrid lives={filtered} loading={q.isFetching} emptyMessage={emptyMessage} />
    </div>
  );
}
