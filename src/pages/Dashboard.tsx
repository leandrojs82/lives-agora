import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '../auth/googleAuth';
import type { Filters } from '../api/types';
import { EMPTY_FILTERS } from '../api/types';
import { AuthError, QuotaExceededError } from '../api/youtubeClient';
import { useSubscriptions, useRemoteSearch, QK } from '../hooks/useLives';
import { DISCOVER_INITIAL_COST } from '../lib/categories';
import { getQuotaUsed, pacificDateKey } from '../lib/quota';
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
  const [armed, setArmed] = useState<Record<TabKey, boolean>>(() => ({
    subscribed: false,
    discover: loadTab() === 'discover',
  }));
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ subscribed: 0, discover: 0 });
  const [quotaUsed, setQuotaUsed] = useState(getQuotaUsed());
  const [reloadingSubs, setReloadingSubs] = useState(false);
  const [reloadError, setReloadError] = useState<unknown>(null);
  const [quotaFlags, setQuotaFlags] = useState<Record<TabKey, boolean>>({ subscribed: false, discover: false });
  const [exceededDay, setExceededDay] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const subscribedIds = useMemo(() => new Set((subs.data ?? []).map((c) => c.id)), [subs.data]);
  const isFetching = useIsFetching() > 0;
  const remoteSearch = useRemoteSearch(subscribedIds);

  // Reavalia o "há X min" e a virada do dia de cota sem exigir ação do usuário.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Atualiza o badge de cota sempre que algo terminou de buscar.
  useEffect(() => {
    setQuotaUsed(getQuotaUsed());
  }, [isFetching, remoteSearch.isPending, subs.data]);

  const changeTab = (t: TabKey) => {
    setTab(t);
    cacheSet(CACHE_KEYS.activeTab, t);
    if (t === 'discover') setArmed((a) => (a.discover ? a : { ...a, discover: true }));
  };

  const onCountSubscribed = useCallback((n: number) => setCounts((c) => (c.subscribed === n ? c : { ...c, subscribed: n })), []);
  const onCountDiscover = useCallback((n: number) => setCounts((c) => (c.discover === n ? c : { ...c, discover: n })), []);
  const onQuotaExceededSubscribed = useCallback(
    (exceeded: boolean) => setQuotaFlags((f) => (f.subscribed === exceeded ? f : { ...f, subscribed: exceeded })),
    [],
  );
  const onQuotaExceededDiscover = useCallback(
    (exceeded: boolean) => setQuotaFlags((f) => (f.discover === exceeded ? f : { ...f, discover: exceeded })),
    [],
  );

  const rawQuotaExceeded =
    quotaFlags.subscribed ||
    quotaFlags.discover ||
    subs.error instanceof QuotaExceededError ||
    reloadError instanceof QuotaExceededError;

  useEffect(() => {
    if (rawQuotaExceeded) {
      setExceededDay((d) => d ?? pacificDateKey());
    } else {
      setExceededDay(null);
    }
  }, [rawQuotaExceeded]);

  const quotaExceeded = rawQuotaExceeded && exceededDay === pacificDateKey();

  const refresh = () => {
    const queryKey = tab === 'subscribed' ? QK.subscribed : QK.discover;
    const wasArmed = armed[tab];

    if (tab === 'discover') remoteSearch.reset();

    if (!wasArmed) {
      setArmed((a) => ({ ...a, [tab]: true }));
      // Neste render a query ainda está desabilitada (o enable só é aplicado
      // no próximo render), então refetchQueries não faria nada (ele ignora
      // queries desabilitadas). invalidateQueries marca a query como stale;
      // quando o flip de enabled acontecer, isStaleByTime já vê a query
      // stale e dispara a busca sozinha — sem duplicar o request.
      qc.invalidateQueries({ queryKey });
    } else {
      qc.refetchQueries({ queryKey });
    }
  };

  const reloadSubscriptions = async () => {
    if (quotaExceeded) return;
    setReloadingSubs(true);
    try {
      await subs.reload();
      setReloadError(null);
    } catch (e) {
      if (e instanceof AuthError) {
        onSignOut();
      } else {
        setReloadError(e);
      }
    } finally {
      setReloadingSubs(false);
      setQuotaUsed(getQuotaUsed());
    }
  };

  useEffect(() => {
    if (subs.error instanceof AuthError) onSignOut();
  }, [subs.error, onSignOut]);

  const subsBanner = subs.error ? errorToBanner(subs.error) : null;
  const reloadBanner = reloadError ? errorToBanner(reloadError) : null;

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
        refreshCostLabel={tab === 'discover' ? `~${DISCOVER_INITIAL_COST} un.` : undefined}
        showRemoteSearch={tab === 'discover'}
        onRemoteSearch={() => remoteSearch.mutate(filters)}
        remoteSearching={remoteSearch.isPending}
        disabled={!subs.data || quotaExceeded}
      />

      <main className="mx-auto max-w-7xl w-full px-4 py-4 flex-1">
        {subsBanner && <Banner kind={subsBanner.kind}>{subsBanner.text}</Banner>}
        {reloadBanner && <Banner kind={reloadBanner.kind}>{reloadBanner.text}</Banner>}
        {!subs.data && !subs.error && (
          <p className="text-center text-yt-muted py-16">Carregando suas inscrições…</p>
        )}
        {subs.data && (
          <>
            <div hidden={tab !== 'subscribed'}>
              <SubscribedTab
                channels={subs.data}
                filters={filters}
                armed={armed.subscribed}
                onCount={onCountSubscribed}
                onAuthError={onSignOut}
                onQuotaExceeded={onQuotaExceededSubscribed}
              />
            </div>
            <div hidden={tab !== 'discover'}>
              <DiscoverTab
                subscribedIds={subscribedIds}
                filters={filters}
                armed={armed.discover}
                remoteError={remoteSearch.error}
                onCount={onCountDiscover}
                onAuthError={onSignOut}
                onQuotaExceeded={onQuotaExceededDiscover}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
