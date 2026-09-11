import type { LiveStream, Filters } from '../api/types';

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesFilters(s: LiveStream, f: Filters): boolean {
  if (f.categoryId && s.categoryId !== f.categoryId) return false;

  if (f.language && s.language) {
    if (!s.language.toLowerCase().startsWith(f.language.toLowerCase())) return false;
  }

  const q = normalizeText(f.query.trim());
  if (q) {
    const hay = normalizeText(`${s.title} ${s.channelTitle}`);
    if (!hay.includes(q)) return false;
  }

  // f.region é ignorado localmente: só se aplica à busca remota.
  return true;
}

export function sortStreams(list: LiveStream[]): LiveStream[] {
  return [...list].sort((a, b) => {
    const va = a.viewers ?? -1;
    const vb = b.viewers ?? -1;
    if (vb !== va) return vb - va;
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  });
}

export function applyFilters(list: LiveStream[], f: Filters): LiveStream[] {
  return sortStreams(list.filter((s) => matchesFilters(s, f)));
}
