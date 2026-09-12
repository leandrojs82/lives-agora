import type { LiveStream, Filters } from '../api/types';
import { WESTERN_LANGUAGES } from './categories';

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

/** 0 = idioma ocidental, 1 = idioma desconhecido, 2 = demais. */
function westernRank(s: LiveStream): number {
  if (!s.language) return 1;
  const base = s.language.toLowerCase().split('-')[0];
  return WESTERN_LANGUAGES.includes(base) ? 0 : 2;
}

export interface SortOptions {
  /** Ordena idiomas ocidentais primeiro (sem remover os demais). */
  preferWestern?: boolean;
}

export function sortStreams(list: LiveStream[], opts: SortOptions = {}): LiveStream[] {
  return [...list].sort((a, b) => {
    if (opts.preferWestern) {
      const ra = westernRank(a);
      const rb = westernRank(b);
      if (ra !== rb) return ra - rb;
    }
    const va = a.viewers ?? -1;
    const vb = b.viewers ?? -1;
    if (vb !== va) return vb - va;
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  });
}

export function applyFilters(
  list: LiveStream[],
  f: Filters,
  opts: SortOptions = {},
): LiveStream[] {
  return sortStreams(list.filter((s) => matchesFilters(s, f)), opts);
}
