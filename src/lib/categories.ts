export const CATEGORIES: { id: string; name: string }[] = [
  { id: '20', name: 'Jogos' },
  { id: '10', name: 'Música' },
  { id: '25', name: 'Notícias' },
  { id: '27', name: 'Educação' },
  { id: '17', name: 'Esportes' },
  { id: '24', name: 'Entretenimento' },
  { id: '28', name: 'Ciência e Tecnologia' },
  { id: '22', name: 'Pessoas e Blogs' },
];

export interface DiscoverTarget {
  region: string | null;
  language: string | null;
  categoryIds: string[];
}

/**
 * Alvos da carga inicial da Descoberta (100 un. por consulta).
 * `regionCode` sozinho não filtra origem (só o que é visível na região), por
 * isso os alvos ocidentais combinam com `relevanceLanguage`. O alvo global
 * (sem região/idioma) mantém o resto do mundo presente, só com menos peso.
 */
export const DISCOVER_TARGETS: DiscoverTarget[] = [
  { region: 'BR', language: 'pt', categoryIds: ['20', '10', '25'] },
  { region: 'US', language: 'en', categoryIds: ['20', '10', '25'] },
  { region: null, language: null, categoryIds: ['20', '10'] },
];

/** Custo estimado (unidades) da carga inicial / Atualizar da Descoberta. */
export const DISCOVER_INITIAL_COST =
  DISCOVER_TARGETS.reduce((n, t) => n + t.categoryIds.length, 0) * 100 + 1;

/** Prefixos ISO 639-1 considerados "ocidentais" para a ordenação da Descoberta. */
export const WESTERN_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it'];

export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'Inglês' },
  { code: 'es', name: 'Espanhol' },
  { code: 'ja', name: 'Japonês' },
  { code: 'ko', name: 'Coreano' },
  { code: 'fr', name: 'Francês' },
  { code: 'de', name: 'Alemão' },
  { code: 'ru', name: 'Russo' },
];

export const REGIONS: { code: string; name: string }[] = [
  { code: 'BR', name: 'Brasil' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Espanha' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CA', name: 'Canadá' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'FR', name: 'França' },
  { code: 'DE', name: 'Alemanha' },
  { code: 'IT', name: 'Itália' },
  { code: 'JP', name: 'Japão' },
  { code: 'KR', name: 'Coreia do Sul' },
  { code: 'IN', name: 'Índia' },
  { code: 'AU', name: 'Austrália' },
];

/**
 * Continentes: a API só aceita um `regionCode` por busca, então cada
 * continente vira uma busca por país representativo (100 un. cada).
 * O valor no filtro usa o prefixo `continent:` para não colidir com países.
 */
export const CONTINENTS: { code: string; name: string; countries: string[] }[] = [
  { code: 'continent:SA', name: 'América do Sul', countries: ['BR', 'AR', 'CO'] },
  { code: 'continent:NA', name: 'América do Norte', countries: ['US', 'MX', 'CA'] },
  { code: 'continent:EU', name: 'Europa', countries: ['GB', 'DE', 'FR'] },
  { code: 'continent:AS', name: 'Ásia', countries: ['JP', 'KR', 'IN'] },
  { code: 'continent:AF', name: 'África', countries: ['ZA', 'NG', 'EG'] },
  { code: 'continent:OC', name: 'Oceania', countries: ['AU', 'NZ'] },
];

const continentMap = new Map(CONTINENTS.map((c) => [c.code, c.countries]));

/** Países consultados para um valor do filtro de região ([] = sem região). */
export function regionCodesFor(region: string | null): string[] {
  if (!region) return [];
  return continentMap.get(region) ?? [region];
}

/** Custo estimado (unidades) de "Buscar no YouTube" com o filtro de região dado. */
export function remoteSearchCost(region: string | null): number {
  return Math.max(1, regionCodesFor(region).length) * 100 + 1;
}

const categoryMap = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const languageMap = new Map(LANGUAGES.map((l) => [l.code, l.name]));

export function categoryName(id: string): string {
  return categoryMap.get(id) ?? 'Outros';
}

export function languageName(code?: string): string {
  if (!code) return '';
  const base = code.toLowerCase().split('-')[0];
  return languageMap.get(base) ?? code;
}
