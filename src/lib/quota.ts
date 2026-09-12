const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data "YYYY-MM-DD" no fuso do Pacífico (dia de reset da cota do Google). */
export function pacificDateKey(now: Date = new Date()): string {
  return formatter.format(now);
}

function storageKey(now?: Date): string {
  return `quota:${pacificDateKey(now)}`;
}

export function getQuotaUsed(now?: Date): number {
  try {
    const n = Number(localStorage.getItem(storageKey(now)) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Contador separado de chamadas search.list (o Google tem um limite próprio para elas). */
function searchKey(now?: Date): string {
  return `quota-search:${pacificDateKey(now)}`;
}

export function getSearchCount(now?: Date): number {
  try {
    const n = Number(localStorage.getItem(searchKey(now)) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function addSearchCount(now?: Date): number {
  const total = getSearchCount(now) + 1;
  try {
    localStorage.setItem(searchKey(now), String(total));
  } catch {
    // storage indisponível
  }
  return total;
}

export function addQuota(units: number, now?: Date): number {
  const total = getQuotaUsed(now) + units;
  try {
    localStorage.setItem(storageKey(now), String(total));
  } catch {
    // storage indisponível: só perde a estimativa
  }
  return total;
}
