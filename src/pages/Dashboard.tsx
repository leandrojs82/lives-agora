import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '../auth/googleAuth';
import type { Filters } from '../api/types';
import { EMPTY_FILTERS } from '../api/types';
import { AuthError } from '../api/youtubeClient';
import { useSubscriptions, QK } from '../hooks/useLives';
import { getQuotaUsed } from '../lib/quota';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';
import Header from '../components/Header';
import Tabs, { type TabKey } from '../components/Tabs';
import FilterBar from '../components/FilterBar';
import Banner from '../components/Banner';
import SubscribedTab from './SubscribedTab';
import DiscoverTab from './DiscoverTab';
import { errorToBanner } from './errorBanner';

interface Props {
  user: AuthUser;
  onSignOut: () => void;
}

function loadTab(): TabKey {
  const t = cacheGet<TabKey>(CACHE_KEYS.activeTab)?.value;
  return t === 'discover' ? 'discover' : 'subscribed';
}

export default function Dashboard({ user, onSignOut }: Props) {
  const qc = useQueryClient();
  const subs = useSubscriptions();
  const [tab, setTab] = useState<TabKey>(loadTab);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ subscribed: 0, discover: 0 });
  const [quotaUsed, setQuotaUsed] = useState(getQuotaUsed());
  const [reloadingSubs, setReloadingSubs] = useState(false);
  const [remote, setRemote] = useState<{ fn: (() => void) | null; busy: boolean }>({ fn: null, busy: false });

  const subscribedIds = useMemo(() => new Set((subs.data ?? []).map((c) => c.id)), [subs.data]);
  const isFetching = qc.isFetching() > 0;

  // Atualiza o badge de cota sempre que algo terminou de buscar.
  useEffect(() => {
    setQuotaUsed(getQuotaUsed());
  }, [isFetching, remote.busy, subs.data]);

  const changeTab = (t: TabKey) => {
    setTab(t);
    cacheSet(CACHE_KEYS.activeTab, t);
  };

  const onCountSubscribed = useCallback((n: number) => setCounts((c) => (c.subscribed === n ? c : { ...c, subscribed: n })), []);
  const onCountDiscover = useCallback((n: number) => setCounts((c) => (c.discover === n ? c : { ...c, discover: n })), []);
  const onRemoteSearchRef = useCallback((fn: (() => void) | null, busy: boolean) => setRemote({ fn, busy }), []);

  const refresh = () => {
    if (tab === 'subscribed') qc.refetchQueries({ queryKey: QK.subscribed });
    else qc.refetchQueries({ queryKey: QK.discover });
  };

  const reloadSubscriptions = async () => {
    setReloadingSubs(true);
    try {
      await subs.reload();
    } finally {
      setReloadingSubs(false);
      setQuotaUsed(getQuotaUsed());
    }
  };

  useEffect(() => {
    if (subs.error instanceof AuthError) onSignOut();
  }, [subs.error, onSignOut]);

  return (
    <div className="min-h-full flex flex-col">
      <Header
        user={user}
        quotaUsed={quotaUsed}
        reloadingSubs={reloadingSubs}
        onReloadSubscriptions={reloadSubscriptions}
        onSignOut={onSignOut}
      />
      <Tabs active={tab} counts={counts} onChange={changeTab} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={refresh}
        refreshing={isFetching}
        showRemoteSearch={tab === 'discover'}
        onRemoteSearch={() => remote.fn?.()}
        remoteSearching={remote.busy}
        disabled={!subs.data}
      />

      <main className="mx-auto max-w-7xl w-full px-4 py-4 flex-1">
        {subs.error && <Banner kind={errorToBanner(subs.error).kind}>{errorToBanner(subs.error).text}</Banner>}
        {!subs.data && !subs.error && (
          <p className="text-center text-yt-muted py-16">Carregando suas inscrições…</p>
        )}
        {subs.data && (
          <>
            <div hidden={tab !== 'subscribed'}>
              <SubscribedTab
                channels={subs.data}
                filters={filters}
                onCount={onCountSubscribed}
                onAuthError={onSignOut}
              />
            </div>
            <div hidden={tab !== 'discover'}>
              <DiscoverTab
                subscribedIds={subscribedIds}
                filters={filters}
                onCount={onCountDiscover}
                onAuthError={onSignOut}
                onRemoteSearchRef={onRemoteSearchRef}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
