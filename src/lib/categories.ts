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

/** Categorias consultadas na carga inicial da aba Descoberta (100 un. por consulta). */
export const DISCOVER_CATEGORY_IDS = ['20', '10', '25'];

/**
 * Alvos regionais da carga inicial. `regionCode` sozinho não filtra origem
 * (só o que é visível na região), por isso combina com `relevanceLanguage`.
 */
export const DISCOVER_TARGETS: { region: string; language: string }[] = [
  { region: 'BR', language: 'pt' },
  { region: 'US', language: 'en' },
];

/** Custo estimado (unidades) da carga inicial / Atualizar da Descoberta. */
export const DISCOVER_INITIAL_COST =
  DISCOVER_TARGETS.length * DISCOVER_CATEGORY_IDS.length * 100 + 1;

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
  { code: 'GB', name: 'Reino Unido' },
  { code: 'JP', name: 'Japão' },
  { code: 'KR', name: 'Coreia do Sul' },
  { code: 'FR', name: 'França' },
  { code: 'DE', name: 'Alemanha' },
];

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
