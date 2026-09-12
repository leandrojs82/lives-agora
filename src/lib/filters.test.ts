import { describe, it, expect } from 'vitest';
import type { LiveStream, Filters } from '../api/types';
import { EMPTY_FILTERS } from '../api/types';
import { normalizeText, matchesFilters, sortStreams, applyFilters } from './filters';

function live(over: Partial<LiveStream>): LiveStream {
  return {
    videoId: 'v',
    title: 'Título',
    channelId: 'UC1',
    channelTitle: 'Canal',
    thumbnailUrl: '',
    categoryId: '20',
    startedAt: '2026-09-11T10:00:00Z',
    isSubscribed: false,
    ...over,
  };
}

describe('normalizeText', () => {
  it('remove acentos e caixa', () => {
    expect(normalizeText('Ação Élite')).toBe('acao elite');
  });
});

describe('matchesFilters', () => {
  it('sem filtros aceita tudo', () => {
    expect(matchesFilters(live({}), EMPTY_FILTERS)).toBe(true);
  });

  it('filtra por categoria', () => {
    const f: Filters = { ...EMPTY_FILTERS, categoryId: '10' };
    expect(matchesFilters(live({ categoryId: '10' }), f)).toBe(true);
    expect(matchesFilters(live({ categoryId: '20' }), f)).toBe(false);
  });

  it('filtra idioma por prefixo e mantém sem idioma', () => {
    const f: Filters = { ...EMPTY_FILTERS, language: 'pt' };
    expect(matchesFilters(live({ language: 'pt-BR' }), f)).toBe(true);
    expect(matchesFilters(live({ language: 'PT' }), f)).toBe(true);
    expect(matchesFilters(live({ language: 'en' }), f)).toBe(false);
    expect(matchesFilters(live({ language: undefined }), f)).toBe(true);
  });

  it('busca em título e canal sem acento/caixa', () => {
    const f: Filters = { ...EMPTY_FILTERS, query: 'futebol' };
    expect(matchesFilters(live({ title: 'FUTEBÓL ao vivo' }), f)).toBe(true);
    expect(matchesFilters(live({ channelTitle: 'Canal Futebol' }), f)).toBe(true);
    expect(matchesFilters(live({ title: 'Xadrez' }), f)).toBe(false);
  });

  it('ignora região (só busca remota)', () => {
    const f: Filters = { ...EMPTY_FILTERS, region: 'JP' };
    expect(matchesFilters(live({}), f)).toBe(true);
  });
});

describe('sortStreams', () => {
  it('ordena por viewers desc, depois startedAt desc, sem mutar', () => {
    const a = live({ videoId: 'a', viewers: 10, startedAt: '2026-09-11T10:00:00Z' });
    const b = live({ videoId: 'b', viewers: 50, startedAt: '2026-09-11T09:00:00Z' });
    const c = live({ videoId: 'c', viewers: undefined, startedAt: '2026-09-11T11:00:00Z' });
    const d = live({ videoId: 'd', viewers: 10, startedAt: '2026-09-11T12:00:00Z' });
    const input = [a, b, c, d];
    const out = sortStreams(input);
    expect(out.map((s) => s.videoId)).toEqual(['b', 'd', 'a', 'c']);
    expect(input.map((s) => s.videoId)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('sortStreams preferWestern', () => {
  it('ocidentais primeiro, depois sem idioma, depois demais; viewers dentro do grupo', () => {
    const hi = live({ videoId: 'hi', language: 'hi', viewers: 90_000 });
    const none = live({ videoId: 'none', language: undefined, viewers: 50_000 });
    const en = live({ videoId: 'en', language: 'en', viewers: 100 });
    const ptbr = live({ videoId: 'ptbr', language: 'pt-BR', viewers: 500 });
    const out = sortStreams([hi, none, en, ptbr], { preferWestern: true });
    expect(out.map((s) => s.videoId)).toEqual(['ptbr', 'en', 'none', 'hi']);
    // sem a opção, continua puramente por viewers
    expect(sortStreams([hi, none, en, ptbr]).map((s) => s.videoId)).toEqual(['hi', 'none', 'ptbr', 'en']);
  });
});

describe('applyFilters', () => {
  it('filtra e ordena', () => {
    const list = [
      live({ videoId: 'x', categoryId: '10', viewers: 1 }),
      live({ videoId: 'y', categoryId: '20', viewers: 5 }),
      live({ videoId: 'z', categoryId: '20', viewers: 9 }),
    ];
    const out = applyFilters(list, { ...EMPTY_FILTERS, categoryId: '20' });
    expect(out.map((s) => s.videoId)).toEqual(['z', 'y']);
  });
});
