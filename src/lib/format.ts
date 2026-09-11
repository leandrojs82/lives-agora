const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatViewers(n?: number): string {
  if (n === undefined || n === null) return '';
  return compact.format(n);
}

export function formatElapsed(startedAt: string, nowMs: number = Date.now()): string {
  const start = Date.parse(startedAt);
  const totalMin = Number.isFinite(start) ? Math.max(0, Math.floor((nowMs - start) / 60_000)) : 0;
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

export function formatAgo(tsMs: number, nowMs: number = Date.now()): string {
  const diffMin = Math.floor((nowMs - tsMs) / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  return `há ${Math.floor(diffH / 24)} d`;
}
