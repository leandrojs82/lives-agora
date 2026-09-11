# YouTube Live Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SPA/PWA de uso pessoal que faz login Google (GIS) e mostra apenas lives ao vivo agora, em duas abas (Inscritos / Descoberta), com filtros locais e busca remota opcional, respeitando a cota da YouTube Data API v3.

**Architecture:** Vite + React SPA sem backend. `auth/` encapsula o Google Identity Services (token em memória). `api/` fala com a YouTube Data API v3 via um cliente único que trata 401/403 e contabiliza cota. `lib/` contém funções puras (cache, cota, filtros, formatação). Componentes React consomem dados via TanStack Query com `staleTime: Infinity` (só o botão Atualizar refaz chamadas).

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind CSS 3.4, @tanstack/react-query 5, Google Identity Services (`@types/google.accounts`), vite-plugin-pwa, Vitest 2 + jsdom.

**Spec:** `docs/superpowers/specs/2026-09-11-youtube-live-dashboard-design.md`

## Global Constraints

- Sem backend; todas as chamadas à YouTube API saem do navegador com o token do usuário. Sem API key.
- Escopo OAuth exato: `openid email profile https://www.googleapis.com/auth/youtube.readonly`.
- Custos de cota fixos: `search` = 100; `subscriptions`, `playlistItems`, `videos` = 1 por chamada. Limite diário 10.000. Dia de cota no fuso `America/Los_Angeles`.
- Nunca usar `search.list` por canal inscrito. Inscritos = `playlistItems.list` (playlist `UU` + `channelId.slice(2)`, `maxResults=5`) + `videos.list` em lotes de 50, mantendo só `snippet.liveBroadcastContent === "live"`.
- Concorrência de `playlistItems.list` limitada a 8 em paralelo.
- Descoberta inicial = `search.list eventType=live type=video order=viewCount maxResults=50` para as categorias 20, 10, 25, 17, 24; remover canais inscritos.
- Filtro Região só se aplica à busca remota ("Buscar no YouTube"). Localmente fica desabilitado.
- Lives sem `language` são mantidas pelo filtro de idioma. Busca textual sem distinção de caixa/acento.
- Ordenação: `viewers` desc, depois `startedAt` desc.
- Atualização somente manual. `staleTime: Infinity`.
- Service worker nunca cacheia `googleapis.com` nem `accounts.google.com`.
- Todo texto de UI em português (pt-BR). Tema escuro padrão, mobile-first.
- **Sem commits git** (preferência do usuário para este projeto). Os passos de commit foram omitidos; se quiser versionar, rode `git init` e commite ao fim de cada task.
- Variável de ambiente: `VITE_GOOGLE_CLIENT_ID`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/index.css`, `src/vite-env.d.ts`, `.env.example`, `.gitignore` | Scaffold e build |
| `src/config.ts` | Constantes: client id, escopos, base URL, custos de cota |
| `src/api/types.ts` | `Channel`, `LiveStream`, `Filters` |
| `src/lib/cache.ts` | localStorage com TTL + chaves de cache |
| `src/lib/quota.ts` | Contador diário de cota (fuso Pacífico) |
| `src/lib/categories.ts` | Listas de categorias, idiomas, regiões |
| `src/lib/filters.ts` | Filtro/ordenação local (puro) |
| `src/lib/format.ts` | Formatação de viewers, tempo decorrido, "há X min" |
| `src/lib/concurrency.ts` | `mapWithConcurrency` |
| `src/api/youtubeClient.ts` | `ytGet`, erros tipados, contagem de cota, retry 401 |
| `src/api/subscriptions.ts` | Lista inscrições (paginado + cache 24h) |
| `src/api/videos.ts` | `videos.list` em lotes → `LiveStream[]` |
| `src/api/liveFromChannels.ts` | Lives dos canais inscritos |
| `src/api/discover.ts` | Descoberta inicial + busca remota |
| `src/auth/googleAuth.ts` | Wrapper GIS (sem React) |
| `src/auth/useAuth.ts` | Hook de auth |
| `src/hooks/useLives.ts` | Queries/mutations TanStack |
| `src/components/*.tsx` | Header, QuotaBadge, Tabs, FilterBar, LiveCard, LiveGrid, Banner |
| `src/pages/*.tsx` | LoginPage, SubscribedTab, DiscoverTab, Dashboard |
| `src/App.tsx`, `src/main.tsx` | Composição |
| `public/icon.svg` + ícones gerados, `README.md` | PWA e docs |

---

### Task 1: Scaffold do projeto (Vite + React + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/test/smoke.test.ts`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: projeto que roda `npm run dev`, `npm run build`, `npm test`. Alias nenhum (imports relativos).

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "youtube-live-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "pwa-assets-generator --preset minimal public/icon.svg"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/google.accounts": "^0.0.15",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vite-pwa/assets-generator": "^0.2.6",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Criar `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
});
```

- [ ] **Step 3: Criar `tsconfig.json` e `tsconfig.node.json`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vite/client", "google.accounts", "vitest/importMeta"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "tailwind.config.js", "postcss.config.js"]
}
```

- [ ] **Step 4: Criar Tailwind/PostCSS**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        yt: { red: '#ff0000', bg: '#0f0f0f', surface: '#1f1f1f', border: '#303030', text: '#f1f1f1', muted: '#aaaaaa' },
      },
    },
  },
  plugins: [],
};
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-yt-bg text-yt-text antialiased; }
```

- [ ] **Step 5: Criar `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`**

`index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f0f0f" />
    <title>Lives Agora</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx` (placeholder; será substituído na Task 10):
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx` (placeholder):
```tsx
export default function App() {
  return <main className="p-6 text-xl">Lives Agora — scaffold OK</main>;
}
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 6: Criar setup de teste e teste de fumaça**

`src/test/setup.ts`:
```ts
import { beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
```

`src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('ambiente de teste', () => {
  it('tem localStorage (jsdom)', () => {
    localStorage.setItem('a', '1');
    expect(localStorage.getItem('a')).toBe('1');
  });
});
```

- [ ] **Step 7: Criar `.env.example` e `.gitignore`**

`.env.example`:
```
VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
```

`.gitignore`:
```
node_modules
dist
dev-dist
.env
.env.local
```

- [ ] **Step 8: Instalar e verificar**

Run: `npm install`
Run: `npm test`
Expected: `1 passed`.
Run: `npm run build`
Expected: build sem erros, pasta `dist/` criada.
Run: `npm run dev` e abrir `http://localhost:5173` → texto "Lives Agora — scaffold OK" em fundo escuro. Parar o servidor.

---

### Task 2: `config.ts`, `api/types.ts` e `lib/cache.ts`

**Files:**
- Create: `src/config.ts`, `src/api/types.ts`, `src/lib/cache.ts`
- Test: `src/lib/cache.test.ts`

**Interfaces:**
- Produces:
  - `config.ts`: `GOOGLE_CLIENT_ID: string`, `OAUTH_SCOPES: string`, `YT_API_BASE: string`, `QUOTA_DAILY_LIMIT = 10000`, `QUOTA_COST: Record<YtResource, number>`, `type YtResource = 'search' | 'subscriptions' | 'playlistItems' | 'videos'`.
  - `types.ts`: `Channel`, `LiveStream`, `Filters`, `EMPTY_FILTERS`.
  - `cache.ts`: `cacheSet<T>(key, value, ttlMs?)`, `cacheGet<T>(key): { value: T; savedAt: number } | null`, `cacheRemove(key)`, `CACHE_KEYS`, `clearLiveCaches()`.

- [ ] **Step 1: Escrever `src/config.ts`**

```ts
export type YtResource = 'search' | 'subscriptions' | 'playlistItems' | 'videos';

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const OAUTH_SCOPES =
  'openid email profile https://www.googleapis.com/auth/youtube.readonly';
export const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
export const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const QUOTA_DAILY_LIMIT = 10_000;
export const QUOTA_COST: Record<YtResource, number> = {
  search: 100,
  subscriptions: 1,
  playlistItems: 1,
  videos: 1,
};

export const PLAYLIST_CONCURRENCY = 8;
export const SUBSCRIPTIONS_TTL_MS = 24 * 60 * 60 * 1000;
```

- [ ] **Step 2: Escrever `src/api/types.ts`**

```ts
export interface Channel {
  id: string;
  title: string;
  thumbnailUrl: string;
}

export interface LiveStream {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  categoryId: string;
  language?: string;
  viewers?: number;
  startedAt: string;
  isSubscribed: boolean;
}

export interface Filters {
  categoryId: string | null;
  region: string | null;
  language: string | null;
  query: string;
}

export const EMPTY_FILTERS: Filters = {
  categoryId: null,
  region: null,
  language: null,
  query: '',
};
```

- [ ] **Step 3: Escrever o teste `src/lib/cache.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cacheSet, cacheGet, cacheRemove, CACHE_KEYS, clearLiveCaches } from './cache';

afterEach(() => vi.useRealTimers());

describe('cache', () => {
  it('retorna null quando não há entrada', () => {
    expect(cacheGet('x')).toBeNull();
  });

  it('salva e lê valor sem TTL', () => {
    cacheSet('k', { a: 1 });
    expect(cacheGet<{ a: number }>('k')?.value).toEqual({ a: 1 });
  });

  it('expõe savedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00Z'));
    cacheSet('k', 1);
    expect(cacheGet('k')?.savedAt).toBe(Date.parse('2026-09-11T10:00:00Z'));
  });

  it('expira quando TTL passa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00Z'));
    cacheSet('k', 'v', 1000);
    vi.setSystemTime(new Date('2026-09-11T10:00:00.999Z'));
    expect(cacheGet('k')?.value).toBe('v');
    vi.setSystemTime(new Date('2026-09-11T10:00:01.001Z'));
    expect(cacheGet('k')).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('ignora JSON corrompido', () => {
    localStorage.setItem('k', '{not json');
    expect(cacheGet('k')).toBeNull();
  });

  it('cacheRemove apaga', () => {
    cacheSet('k', 1);
    cacheRemove('k');
    expect(cacheGet('k')).toBeNull();
  });

  it('clearLiveCaches apaga só caches de lives, mantém inscrições', () => {
    cacheSet(CACHE_KEYS.subs, []);
    cacheSet(CACHE_KEYS.livesSubscribed, []);
    cacheSet(CACHE_KEYS.livesDiscover, []);
    clearLiveCaches();
    expect(cacheGet(CACHE_KEYS.subs)).not.toBeNull();
    expect(cacheGet(CACHE_KEYS.livesSubscribed)).toBeNull();
    expect(cacheGet(CACHE_KEYS.livesDiscover)).toBeNull();
  });
});
```

- [ ] **Step 4: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/cache.test.ts`
Expected: FAIL — `Cannot find module './cache'`.

- [ ] **Step 5: Escrever `src/lib/cache.ts`**

```ts
interface Entry<T> {
  value: T;
  savedAt: number;
  ttlMs: number | null;
}

export const CACHE_KEYS = {
  subs: 'subs:v1',
  livesSubscribed: 'lives:subscribed',
  livesDiscover: 'lives:discover',
  activeTab: 'ui:activeTab',
} as const;

export function cacheSet<T>(key: string, value: T, ttlMs?: number): void {
  const entry: Entry<T> = { value, savedAt: Date.now(), ttlMs: ttlMs ?? null };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota do localStorage estourada ou storage indisponível: cache é opcional
  }
}

export function cacheGet<T>(key: string): { value: T; savedAt: number } | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let entry: Entry<T>;
  try {
    entry = JSON.parse(raw) as Entry<T>;
  } catch {
    return null;
  }
  if (entry.ttlMs !== null && Date.now() - entry.savedAt > entry.ttlMs) {
    cacheRemove(key);
    return null;
  }
  return { value: entry.value, savedAt: entry.savedAt };
}

export function cacheRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorar
  }
}

export function clearLiveCaches(): void {
  cacheRemove(CACHE_KEYS.livesSubscribed);
  cacheRemove(CACHE_KEYS.livesDiscover);
}
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/cache.test.ts`
Expected: 7 passed.

---

### Task 3: `lib/quota.ts`

**Files:**
- Create: `src/lib/quota.ts`
- Test: `src/lib/quota.test.ts`

**Interfaces:**
- Consumes: `QUOTA_DAILY_LIMIT` de `config.ts`.
- Produces: `pacificDateKey(now?: Date): string` ("YYYY-MM-DD"), `getQuotaUsed(now?: Date): number`, `addQuota(units: number, now?: Date): number` (retorna o total do dia).

- [ ] **Step 1: Escrever `src/lib/quota.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pacificDateKey, addQuota, getQuotaUsed } from './quota';

describe('quota', () => {
  it('pacificDateKey usa o fuso America/Los_Angeles', () => {
    // 2026-09-11T05:00Z = 2026-09-10 22:00 PDT
    expect(pacificDateKey(new Date('2026-09-11T05:00:00Z'))).toBe('2026-09-10');
    // 2026-09-11T08:00Z = 2026-09-11 01:00 PDT
    expect(pacificDateKey(new Date('2026-09-11T08:00:00Z'))).toBe('2026-09-11');
  });

  it('começa em zero', () => {
    expect(getQuotaUsed(new Date('2026-09-11T12:00:00Z'))).toBe(0);
  });

  it('soma unidades do mesmo dia', () => {
    const d = new Date('2026-09-11T12:00:00Z');
    expect(addQuota(100, d)).toBe(100);
    expect(addQuota(1, d)).toBe(101);
    expect(getQuotaUsed(d)).toBe(101);
  });

  it('separa por dia de cota', () => {
    addQuota(500, new Date('2026-09-11T05:00:00Z')); // dia 10 PDT
    addQuota(7, new Date('2026-09-11T08:00:00Z')); // dia 11 PDT
    expect(getQuotaUsed(new Date('2026-09-11T05:00:00Z'))).toBe(500);
    expect(getQuotaUsed(new Date('2026-09-11T08:00:00Z'))).toBe(7);
  });

  it('trata valor corrompido como zero', () => {
    localStorage.setItem('quota:2026-09-11', 'abc');
    expect(getQuotaUsed(new Date('2026-09-11T12:00:00Z'))).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/quota.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Escrever `src/lib/quota.ts`**

```ts
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

export function addQuota(units: number, now?: Date): number {
  const total = getQuotaUsed(now) + units;
  try {
    localStorage.setItem(storageKey(now), String(total));
  } catch {
    // storage indisponível: só perde a estimativa
  }
  return total;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/quota.test.ts`
Expected: 5 passed.

---

### Task 4: `lib/categories.ts` e `lib/filters.ts`

**Files:**
- Create: `src/lib/categories.ts`, `src/lib/filters.ts`
- Test: `src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `LiveStream`, `Filters` de `api/types.ts`.
- Produces:
  - `categories.ts`: `CATEGORIES: { id: string; name: string }[]`, `DISCOVER_CATEGORY_IDS: string[]`, `LANGUAGES: { code: string; name: string }[]`, `REGIONS: { code: string; name: string }[]`, `categoryName(id: string): string`, `languageName(code?: string): string`.
  - `filters.ts`: `normalizeText(s: string): string`, `matchesFilters(s: LiveStream, f: Filters): boolean`, `sortStreams(list: LiveStream[]): LiveStream[]`, `applyFilters(list: LiveStream[], f: Filters): LiveStream[]`.

- [ ] **Step 1: Escrever `src/lib/categories.ts`**

```ts
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

/** Categorias consultadas na carga inicial da aba Descoberta (100 un. cada). */
export const DISCOVER_CATEGORY_IDS = ['20', '10', '25', '17', '24'];

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
```

- [ ] **Step 2: Escrever `src/lib/filters.test.ts`**

```ts
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/filters.test.ts`
Expected: FAIL — módulo `./filters` não encontrado.

- [ ] **Step 4: Escrever `src/lib/filters.ts`**

```ts
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
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/filters.test.ts`
Expected: 8 passed.

---

### Task 5: `lib/format.ts` e `lib/concurrency.ts`

**Files:**
- Create: `src/lib/format.ts`, `src/lib/concurrency.ts`
- Test: `src/lib/format.test.ts`, `src/lib/concurrency.test.ts`

**Interfaces:**
- Produces:
  - `formatViewers(n?: number): string` — `"12,3 mil"`, `"1,2 mi"`, `""` se undefined.
  - `formatElapsed(startedAt: string, nowMs?: number): string` — `"45min"`, `"1h 23min"`, `"2d 3h"`.
  - `formatAgo(tsMs: number, nowMs?: number): string` — `"agora"`, `"há 5 min"`, `"há 2 h"`, `"há 3 d"`.
  - `mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>` — preserva ordem.

- [ ] **Step 1: Escrever `src/lib/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatViewers, formatElapsed, formatAgo } from './format';

describe('formatViewers', () => {
  it('formata compactado em pt-BR', () => {
    expect(formatViewers(undefined)).toBe('');
    expect(formatViewers(0)).toBe('0');
    expect(formatViewers(999)).toBe('999');
    expect(formatViewers(12345)).toBe('12,3 mil');
    expect(formatViewers(1_200_000)).toBe('1,2 mi');
  });
});

describe('formatElapsed', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  it('minutos', () => {
    expect(formatElapsed('2026-09-11T11:15:00Z', now)).toBe('45min');
  });
  it('horas e minutos', () => {
    expect(formatElapsed('2026-09-11T10:37:00Z', now)).toBe('1h 23min');
  });
  it('dias e horas', () => {
    expect(formatElapsed('2026-09-09T09:00:00Z', now)).toBe('2d 3h');
  });
  it('início no futuro ou inválido vira 0min', () => {
    expect(formatElapsed('2026-09-11T13:00:00Z', now)).toBe('0min');
    expect(formatElapsed('lixo', now)).toBe('0min');
  });
});

describe('formatAgo', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  it('casos', () => {
    expect(formatAgo(now - 20_000, now)).toBe('agora');
    expect(formatAgo(now - 5 * 60_000, now)).toBe('há 5 min');
    expect(formatAgo(now - 2 * 3_600_000, now)).toBe('há 2 h');
    expect(formatAgo(now - 3 * 86_400_000, now)).toBe('há 3 d');
  });
});
```

- [ ] **Step 2: Escrever `src/lib/concurrency.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('preserva ordem e limita paralelismo', async () => {
    let running = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7];
    const out = await mapWithConcurrency(items, 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });

  it('lista vazia', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });

  it('propaga erro', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/format.test.ts src/lib/concurrency.test.ts`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 4: Escrever `src/lib/format.ts`**

```ts
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
```

- [ ] **Step 5: Escrever `src/lib/concurrency.ts`**

```ts
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/format.test.ts src/lib/concurrency.test.ts`
Expected: 8 passed.

> Nota: se `formatViewers(12345)` produzir `"12,3 mil"` com espaço não separável (U+00A0) no seu Node, ajuste o teste para `.replace(/ /g, ' ')` na comparação em vez de mudar a implementação.

---

### Task 6: `api/youtubeClient.ts`

**Files:**
- Create: `src/api/youtubeClient.ts`
- Test: `src/api/youtubeClient.test.ts`

**Interfaces:**
- Consumes: `YT_API_BASE`, `QUOTA_COST`, `YtResource` de `config.ts`; `addQuota` de `lib/quota.ts`.
- Produces:
  - `class QuotaExceededError extends Error`
  - `class AuthError extends Error`
  - `class YouTubeApiError extends Error { status: number }`
  - `interface TokenProvider { getToken(): Promise<string>; refreshToken(): Promise<string> }`
  - `configureClient(p: TokenProvider): void`
  - `ytGet<T>(resource: YtResource, params: Record<string, string>): Promise<T>`

- [ ] **Step 1: Escrever `src/api/youtubeClient.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  configureClient,
  ytGet,
  QuotaExceededError,
  AuthError,
  YouTubeApiError,
} from './youtubeClient';
import { getQuotaUsed } from '../lib/quota';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();
const getToken = vi.fn<() => Promise<string>>();
const refreshToken = vi.fn<() => Promise<string>>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getToken.mockReset().mockResolvedValue('tok1');
  refreshToken.mockReset().mockResolvedValue('tok2');
  configureClient({ getToken, refreshToken });
});

describe('ytGet', () => {
  it('monta URL, envia Bearer e conta cota', async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));
    const out = await ytGet<{ items: unknown[] }>('videos', { part: 'snippet', id: 'a,b' });
    expect(out).toEqual({ items: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=a%2Cb');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok1');
    expect(getQuotaUsed()).toBe(1);
  });

  it('search custa 100', async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));
    await ytGet('search', { q: 'x' });
    expect(getQuotaUsed()).toBe(100);
  });

  it('em 401 renova o token e repete uma vez', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ ok: 1 }));
    const out = await ytGet('videos', {});
    expect(out).toEqual({ ok: 1 });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    const [, init2] = fetchMock.mock.calls[1];
    expect((init2!.headers as Record<string, string>).Authorization).toBe('Bearer tok2');
  });

  it('401 persistente vira AuthError', async () => {
    fetchMock.mockResolvedValue(json({}, 401));
    await expect(ytGet('videos', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('403 quotaExceeded vira QuotaExceededError', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403),
    );
    await expect(ytGet('videos', {})).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('403 por outro motivo vira YouTubeApiError', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { errors: [{ reason: 'forbidden' }] } }, 403));
    await expect(ytGet('videos', {})).rejects.toBeInstanceOf(YouTubeApiError);
  });

  it('404 vira YouTubeApiError com status', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404));
    const err = await ytGet('playlistItems', {}).catch((e) => e);
    expect(err).toBeInstanceOf(YouTubeApiError);
    expect((err as YouTubeApiError).status).toBe(404);
  });

  it('sem configureClient lança erro', async () => {
    configureClient(null);
    await expect(ytGet('videos', {})).rejects.toThrow('youtubeClient não configurado');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/api/youtubeClient.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Escrever `src/api/youtubeClient.ts`**

```ts
import { YT_API_BASE, QUOTA_COST, type YtResource } from '../config';
import { addQuota } from '../lib/quota';

export class QuotaExceededError extends Error {
  constructor() {
    super('Cota diária da YouTube API esgotada');
    this.name = 'QuotaExceededError';
  }
}

export class AuthError extends Error {
  constructor(message = 'Sessão expirada. Faça login novamente.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class YouTubeApiError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `YouTube API respondeu ${status}`);
    this.name = 'YouTubeApiError';
  }
}

export interface TokenProvider {
  getToken(): Promise<string>;
  refreshToken(): Promise<string>;
}

let provider: TokenProvider | null = null;

export function configureClient(p: TokenProvider | null): void {
  provider = p;
}

function doFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

interface GoogleErrorBody {
  error?: { errors?: { reason?: string }[]; message?: string };
}

export async function ytGet<T>(resource: YtResource, params: Record<string, string>): Promise<T> {
  if (!provider) throw new Error('youtubeClient não configurado');

  const url = `${YT_API_BASE}/${resource}?${new URLSearchParams(params).toString()}`;

  let token = await provider.getToken();
  let res = await doFetch(url, token);
  addQuota(QUOTA_COST[resource]);

  if (res.status === 401) {
    token = await provider.refreshToken();
    res = await doFetch(url, token);
    addQuota(QUOTA_COST[resource]);
  }

  if (res.ok) return (await res.json()) as T;

  if (res.status === 401) throw new AuthError();

  const body = (await res.json().catch(() => null)) as GoogleErrorBody | null;
  const reason = body?.error?.errors?.[0]?.reason;

  if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
    throw new QuotaExceededError();
  }

  throw new YouTubeApiError(res.status, body?.error?.message);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/api/youtubeClient.test.ts`
Expected: 8 passed.

---

### Task 7: `api/subscriptions.ts`

**Files:**
- Create: `src/api/subscriptions.ts`
- Test: `src/api/subscriptions.test.ts`

**Interfaces:**
- Consumes: `ytGet` de `youtubeClient.ts`; `cacheGet/cacheSet/CACHE_KEYS` de `lib/cache.ts`; `SUBSCRIPTIONS_TTL_MS` de `config.ts`; `Channel`.
- Produces: `fetchAllSubscriptions(): Promise<Channel[]>`, `getSubscriptions(force?: boolean): Promise<Channel[]>`.

- [ ] **Step 1: Escrever `src/api/subscriptions.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllSubscriptions, getSubscriptions } from './subscriptions';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

vi.mock('./youtubeClient', () => ({ ytGet: vi.fn() }));
import { ytGet } from './youtubeClient';
const ytGetMock = vi.mocked(ytGet);

function page(ids: string[], nextPageToken?: string) {
  return {
    nextPageToken,
    items: ids.map((id) => ({
      snippet: {
        title: `Canal ${id}`,
        resourceId: { channelId: id },
        thumbnails: { default: { url: `https://img/${id}.jpg` } },
      },
    })),
  };
}

beforeEach(() => ytGetMock.mockReset());

describe('fetchAllSubscriptions', () => {
  it('pagina até acabar e mapeia canais', async () => {
    ytGetMock.mockResolvedValueOnce(page(['UC1', 'UC2'], 'p2')).mockResolvedValueOnce(page(['UC3']));
    const subs = await fetchAllSubscriptions();
    expect(subs).toEqual([
      { id: 'UC1', title: 'Canal UC1', thumbnailUrl: 'https://img/UC1.jpg' },
      { id: 'UC2', title: 'Canal UC2', thumbnailUrl: 'https://img/UC2.jpg' },
      { id: 'UC3', title: 'Canal UC3', thumbnailUrl: 'https://img/UC3.jpg' },
    ]);
    expect(ytGetMock).toHaveBeenCalledTimes(2);
    expect(ytGetMock.mock.calls[0][1]).toEqual({ part: 'snippet', mine: 'true', maxResults: '50' });
    expect(ytGetMock.mock.calls[1][1]).toEqual({
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
      pageToken: 'p2',
    });
  });
});

describe('getSubscriptions', () => {
  it('usa cache quando existe', async () => {
    cacheSet(CACHE_KEYS.subs, [{ id: 'UC9', title: 'x', thumbnailUrl: '' }]);
    const subs = await getSubscriptions();
    expect(subs[0].id).toBe('UC9');
    expect(ytGetMock).not.toHaveBeenCalled();
  });

  it('busca e grava cache quando não há cache', async () => {
    ytGetMock.mockResolvedValueOnce(page(['UC1']));
    await getSubscriptions();
    expect(cacheGet(CACHE_KEYS.subs)?.value).toEqual([
      { id: 'UC1', title: 'Canal UC1', thumbnailUrl: 'https://img/UC1.jpg' },
    ]);
  });

  it('force ignora cache', async () => {
    cacheSet(CACHE_KEYS.subs, []);
    ytGetMock.mockResolvedValueOnce(page(['UC1']));
    const subs = await getSubscriptions(true);
    expect(subs).toHaveLength(1);
    expect(ytGetMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/api/subscriptions.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Escrever `src/api/subscriptions.ts`**

```ts
import { ytGet } from './youtubeClient';
import type { Channel } from './types';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';
import { SUBSCRIPTIONS_TTL_MS } from '../config';

interface SubscriptionsResponse {
  nextPageToken?: string;
  items: {
    snippet: {
      title: string;
      resourceId: { channelId: string };
      thumbnails?: { default?: { url: string } };
    };
  }[];
}

export async function fetchAllSubscriptions(): Promise<Channel[]> {
  const out: Channel[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = { part: 'snippet', mine: 'true', maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    const data = await ytGet<SubscriptionsResponse>('subscriptions', params);
    for (const item of data.items ?? []) {
      out.push({
        id: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? '',
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export async function getSubscriptions(force = false): Promise<Channel[]> {
  if (!force) {
    const cached = cacheGet<Channel[]>(CACHE_KEYS.subs);
    if (cached) return cached.value;
  }
  const subs = await fetchAllSubscriptions();
  cacheSet(CACHE_KEYS.subs, subs, SUBSCRIPTIONS_TTL_MS);
  return subs;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/api/subscriptions.test.ts`
Expected: 4 passed.

---

### Task 8: `api/videos.ts` e `api/liveFromChannels.ts`

**Files:**
- Create: `src/api/videos.ts`, `src/api/liveFromChannels.ts`
- Test: `src/api/videos.test.ts`, `src/api/liveFromChannels.test.ts`

**Interfaces:**
- Consumes: `ytGet`, `YouTubeApiError`; `mapWithConcurrency`; `PLAYLIST_CONCURRENCY`; `Channel`, `LiveStream`.
- Produces:
  - `videos.ts`: `chunk<T>(arr: T[], size: number): T[][]`, `fetchLiveVideos(ids: string[], subscribedIds: Set<string>): Promise<LiveStream[]>` (dedupe ids, lotes de 50, só `live`).
  - `liveFromChannels.ts`: `uploadsPlaylistId(channelId: string): string`, `fetchLiveFromChannels(channels: Channel[]): Promise<LiveStream[]>`.

- [ ] **Step 1: Escrever `src/api/videos.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunk, fetchLiveVideos } from './videos';

vi.mock('./youtubeClient', () => ({ ytGet: vi.fn() }));
import { ytGet } from './youtubeClient';
const ytGetMock = vi.mocked(ytGet);

function video(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    snippet: {
      title: `T ${id}`,
      channelId: 'UC1',
      channelTitle: 'Canal 1',
      categoryId: '20',
      liveBroadcastContent: 'live',
      defaultAudioLanguage: 'pt-BR',
      thumbnails: { medium: { url: `https://img/${id}/m.jpg` } },
      ...over,
    },
    liveStreamingDetails: { actualStartTime: '2026-09-11T10:00:00Z', concurrentViewers: '1234' },
  };
}

beforeEach(() => ytGetMock.mockReset());

describe('chunk', () => {
  it('divide em lotes', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe('fetchLiveVideos', () => {
  it('deduplica, faz lotes de 50 e mapeia só lives', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `v${i}`);
    ytGetMock
      .mockResolvedValueOnce({ items: [video('v0'), video('v1', { liveBroadcastContent: 'none' })] })
      .mockResolvedValueOnce({ items: [video('v55', { liveBroadcastContent: 'upcoming' })] });

    const out = await fetchLiveVideos([...ids, 'v0'], new Set(['UC1']));

    expect(ytGetMock).toHaveBeenCalledTimes(2);
    expect(ytGetMock.mock.calls[0][1].id.split(',')).toHaveLength(50);
    expect(ytGetMock.mock.calls[1][1].id.split(',')).toHaveLength(10);
    expect(ytGetMock.mock.calls[0][1].part).toBe('snippet,liveStreamingDetails');

    expect(out).toEqual([
      {
        videoId: 'v0',
        title: 'T v0',
        channelId: 'UC1',
        channelTitle: 'Canal 1',
        thumbnailUrl: 'https://img/v0/m.jpg',
        categoryId: '20',
        language: 'pt-BR',
        viewers: 1234,
        startedAt: '2026-09-11T10:00:00Z',
        isSubscribed: true,
      },
    ]);
  });

  it('usa defaultLanguage como fallback e marca não inscrito', async () => {
    ytGetMock.mockResolvedValueOnce({
      items: [video('a', { defaultAudioLanguage: undefined, defaultLanguage: 'en' })],
    });
    const out = await fetchLiveVideos(['a'], new Set());
    expect(out[0].language).toBe('en');
    expect(out[0].isSubscribed).toBe(false);
  });

  it('lista vazia não chama API', async () => {
    expect(await fetchLiveVideos([], new Set())).toEqual([]);
    expect(ytGetMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Escrever `src/api/liveFromChannels.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadsPlaylistId, fetchLiveFromChannels } from './liveFromChannels';
import { YouTubeApiError } from './youtubeClient';

vi.mock('./youtubeClient', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./youtubeClient')>();
  return { ...orig, ytGet: vi.fn() };
});
vi.mock('./videos', () => ({ fetchLiveVideos: vi.fn() }));
import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
const ytGetMock = vi.mocked(ytGet);
const fetchLiveVideosMock = vi.mocked(fetchLiveVideos);

beforeEach(() => {
  ytGetMock.mockReset();
  fetchLiveVideosMock.mockReset().mockResolvedValue([]);
});

describe('uploadsPlaylistId', () => {
  it('troca UC por UU', () => {
    expect(uploadsPlaylistId('UCabc123')).toBe('UUabc123');
  });
  it('rejeita id fora do padrão', () => {
    expect(() => uploadsPlaylistId('HCabc')).toThrow();
  });
});

describe('fetchLiveFromChannels', () => {
  const channels = [
    { id: 'UC1', title: 'a', thumbnailUrl: '' },
    { id: 'UC2', title: 'b', thumbnailUrl: '' },
    { id: 'UC3', title: 'c', thumbnailUrl: '' },
  ];

  it('consulta uploads de cada canal e delega ids ao videos.list', async () => {
    ytGetMock.mockImplementation(async (_res, params) => {
      const p = params as Record<string, string>;
      if (p.playlistId === 'UU2') throw new YouTubeApiError(404);
      return { items: [{ contentDetails: { videoId: `${p.playlistId}-v1` } }] };
    });

    await fetchLiveFromChannels(channels);

    expect(ytGetMock).toHaveBeenCalledTimes(3);
    expect(ytGetMock.mock.calls[0][1]).toEqual({
      part: 'contentDetails',
      playlistId: 'UU1',
      maxResults: '5',
    });
    const [ids, subscribed] = fetchLiveVideosMock.mock.calls[0];
    expect(ids.sort()).toEqual(['UU1-v1', 'UU3-v1']);
    expect([...subscribed].sort()).toEqual(['UC1', 'UC2', 'UC3']);
  });

  it('propaga erros que não sejam 404', async () => {
    ytGetMock.mockRejectedValue(new YouTubeApiError(500));
    await expect(fetchLiveFromChannels(channels)).rejects.toBeInstanceOf(YouTubeApiError);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/api/videos.test.ts src/api/liveFromChannels.test.ts`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 4: Escrever `src/api/videos.ts`**

```ts
import { ytGet } from './youtubeClient';
import type { LiveStream } from './types';

interface VideoItem {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    categoryId: string;
    liveBroadcastContent: 'live' | 'upcoming' | 'none';
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: {
      medium?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
  liveStreamingDetails?: {
    actualStartTime?: string;
    concurrentViewers?: string;
  };
}

interface VideosResponse {
  items?: VideoItem[];
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function mapVideo(v: VideoItem, isSubscribed: boolean): LiveStream {
  const t = v.snippet.thumbnails;
  const viewersRaw = v.liveStreamingDetails?.concurrentViewers;
  return {
    videoId: v.id,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    thumbnailUrl: t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? '',
    categoryId: v.snippet.categoryId,
    language: v.snippet.defaultAudioLanguage ?? v.snippet.defaultLanguage,
    viewers: viewersRaw !== undefined ? Number(viewersRaw) : undefined,
    startedAt: v.liveStreamingDetails?.actualStartTime ?? '',
    isSubscribed,
  };
}

/** videos.list em lotes de 50; devolve só o que está ao vivo agora. */
export async function fetchLiveVideos(
  ids: string[],
  subscribedIds: Set<string>,
): Promise<LiveStream[]> {
  const unique = [...new Set(ids)];
  const out: LiveStream[] = [];
  for (const batch of chunk(unique, 50)) {
    const data = await ytGet<VideosResponse>('videos', {
      part: 'snippet,liveStreamingDetails',
      id: batch.join(','),
      maxResults: '50',
    });
    for (const v of data.items ?? []) {
      if (v.snippet.liveBroadcastContent !== 'live') continue;
      out.push(mapVideo(v, subscribedIds.has(v.snippet.channelId)));
    }
  }
  return out;
}
```

- [ ] **Step 5: Escrever `src/api/liveFromChannels.ts`**

```ts
import { ytGet, YouTubeApiError } from './youtubeClient';
import { fetchLiveVideos } from './videos';
import type { Channel, LiveStream } from './types';
import { mapWithConcurrency } from '../lib/concurrency';
import { PLAYLIST_CONCURRENCY } from '../config';

interface PlaylistItemsResponse {
  items?: { contentDetails: { videoId: string } }[];
}

/** Playlist de uploads de um canal: "UC..." → "UU...". Sem chamada de API. */
export function uploadsPlaylistId(channelId: string): string {
  if (!channelId.startsWith('UC')) {
    throw new Error(`channelId fora do padrão UC: ${channelId}`);
  }
  return 'UU' + channelId.slice(2);
}

async function recentVideoIds(channelId: string): Promise<string[]> {
  try {
    const data = await ytGet<PlaylistItemsResponse>('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId(channelId),
      maxResults: '5',
    });
    return (data.items ?? []).map((i) => i.contentDetails.videoId);
  } catch (e) {
    if (e instanceof YouTubeApiError && e.status === 404) return [];
    throw e;
  }
}

export async function fetchLiveFromChannels(channels: Channel[]): Promise<LiveStream[]> {
  const idLists = await mapWithConcurrency(channels, PLAYLIST_CONCURRENCY, (c) =>
    recentVideoIds(c.id),
  );
  const subscribed = new Set(channels.map((c) => c.id));
  return fetchLiveVideos(idLists.flat(), subscribed);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/api/videos.test.ts src/api/liveFromChannels.test.ts`
Expected: 8 passed.

---

### Task 9: `api/discover.ts`

**Files:**
- Create: `src/api/discover.ts`
- Test: `src/api/discover.test.ts`

**Interfaces:**
- Consumes: `ytGet`; `fetchLiveVideos`; `DISCOVER_CATEGORY_IDS`; `Filters`, `LiveStream`, `EMPTY_FILTERS`.
- Produces: `buildSearchParams(f: Filters): Record<string, string>`, `fetchDiscoverInitial(subscribedIds: Set<string>): Promise<LiveStream[]>`, `searchLive(f: Filters, subscribedIds: Set<string>): Promise<LiveStream[]>`.

- [ ] **Step 1: Escrever `src/api/discover.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSearchParams, fetchDiscoverInitial, searchLive } from './discover';
import { EMPTY_FILTERS } from './types';

vi.mock('./youtubeClient', () => ({ ytGet: vi.fn() }));
vi.mock('./videos', () => ({ fetchLiveVideos: vi.fn() }));
import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
const ytGetMock = vi.mocked(ytGet);
const fetchLiveVideosMock = vi.mocked(fetchLiveVideos);

const base = {
  part: 'snippet',
  eventType: 'live',
  type: 'video',
  order: 'viewCount',
  maxResults: '50',
};

function live(videoId: string, channelId: string, isSubscribed: boolean) {
  return {
    videoId,
    title: '',
    channelId,
    channelTitle: '',
    thumbnailUrl: '',
    categoryId: '20',
    startedAt: '',
    isSubscribed,
  };
}

beforeEach(() => {
  ytGetMock.mockReset();
  fetchLiveVideosMock.mockReset();
});

describe('buildSearchParams', () => {
  it('só base sem filtros', () => {
    expect(buildSearchParams(EMPTY_FILTERS)).toEqual(base);
  });
  it('inclui q, categoria, região, idioma', () => {
    expect(
      buildSearchParams({ query: '  xadrez ', categoryId: '20', region: 'BR', language: 'pt' }),
    ).toEqual({ ...base, q: 'xadrez', videoCategoryId: '20', regionCode: 'BR', relevanceLanguage: 'pt' });
  });
});

describe('fetchDiscoverInitial', () => {
  it('busca 5 categorias, junta ids e remove inscritos', async () => {
    ytGetMock.mockImplementation(async (_r, params) => {
      const p = params as Record<string, string>;
      return { items: [{ id: { videoId: `v-${p.videoCategoryId}` } }] };
    });
    fetchLiveVideosMock.mockResolvedValue([live('v-20', 'UCsub', true), live('v-10', 'UCx', false)]);

    const out = await fetchDiscoverInitial(new Set(['UCsub']));

    expect(ytGetMock).toHaveBeenCalledTimes(5);
    expect(ytGetMock.mock.calls.map((c) => (c[1] as Record<string, string>).videoCategoryId)).toEqual(
      ['20', '10', '25', '17', '24'],
    );
    expect(fetchLiveVideosMock.mock.calls[0][0]).toEqual(['v-20', 'v-10', 'v-25', 'v-17', 'v-24']);
    expect(out.map((l) => l.videoId)).toEqual(['v-10']);
  });
});

describe('searchLive', () => {
  it('uma busca com os filtros e remove inscritos', async () => {
    ytGetMock.mockResolvedValueOnce({ items: [{ id: { videoId: 'a' } }, { id: { videoId: 'b' } }] });
    fetchLiveVideosMock.mockResolvedValue([live('a', 'UCsub', true), live('b', 'UCy', false)]);

    const out = await searchLive({ ...EMPTY_FILTERS, query: 'lofi', region: 'JP' }, new Set(['UCsub']));

    expect(ytGetMock).toHaveBeenCalledTimes(1);
    expect(ytGetMock.mock.calls[0][0]).toBe('search');
    expect(ytGetMock.mock.calls[0][1]).toEqual({ ...base, q: 'lofi', regionCode: 'JP' });
    expect(out.map((l) => l.videoId)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/api/discover.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Escrever `src/api/discover.ts`**

```ts
import { ytGet } from './youtubeClient';
import { fetchLiveVideos } from './videos';
import type { Filters, LiveStream } from './types';
import { EMPTY_FILTERS } from './types';
import { DISCOVER_CATEGORY_IDS } from '../lib/categories';

interface SearchResponse {
  items?: { id: { videoId?: string } }[];
}

export function buildSearchParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {
    part: 'snippet',
    eventType: 'live',
    type: 'video',
    order: 'viewCount',
    maxResults: '50',
  };
  const q = f.query.trim();
  if (q) p.q = q;
  if (f.categoryId) p.videoCategoryId = f.categoryId;
  if (f.region) p.regionCode = f.region;
  if (f.language) p.relevanceLanguage = f.language;
  return p;
}

async function searchVideoIds(params: Record<string, string>): Promise<string[]> {
  const data = await ytGet<SearchResponse>('search', params);
  return (data.items ?? []).map((i) => i.id.videoId).filter((id): id is string => !!id);
}

/** Carga inicial da aba Descoberta: 5 categorias populares (500 un.). */
export async function fetchDiscoverInitial(subscribedIds: Set<string>): Promise<LiveStream[]> {
  const ids: string[] = [];
  for (const categoryId of DISCOVER_CATEGORY_IDS) {
    ids.push(...(await searchVideoIds(buildSearchParams({ ...EMPTY_FILTERS, categoryId }))));
  }
  const lives = await fetchLiveVideos(ids, subscribedIds);
  return lives.filter((l) => !l.isSubscribed);
}

/** Botão "Buscar no YouTube": uma search.list (100 un.) com os filtros atuais. */
export async function searchLive(f: Filters, subscribedIds: Set<string>): Promise<LiveStream[]> {
  const ids = await searchVideoIds(buildSearchParams(f));
  const lives = await fetchLiveVideos(ids, subscribedIds);
  return lives.filter((l) => !l.isSubscribed);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/api/discover.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes passam (cache 7, quota 5, filters 8, format+concurrency 8, client 8, subs 4, videos+live 8, discover 4, smoke 1).

---

### Task 10: Autenticação — `auth/googleAuth.ts`, `auth/useAuth.ts`, `LoginPage`, `main.tsx`

**Files:**
- Create: `src/auth/googleAuth.ts`, `src/auth/useAuth.ts`, `src/pages/LoginPage.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `GOOGLE_CLIENT_ID`, `OAUTH_SCOPES`, `USERINFO_URL`; `configureClient`; `clearLiveCaches`.
- Produces:
  - `googleAuth.ts`: `interface AuthUser { name: string; email: string; picture: string }`, `initAuth(): Promise<void>`, `signIn(): Promise<string>`, `trySilentSignIn(): Promise<string | null>`, `getValidToken(): Promise<string>`, `refreshToken(): Promise<string>`, `fetchUserInfo(token: string): Promise<AuthUser>`, `signOut(): void`.
  - `useAuth.ts`: `useAuth(): { status: 'loading' | 'signedOut' | 'signedIn'; user: AuthUser | null; error: string | null; signIn(): Promise<void>; signOut(): void }`.
  - `App.tsx` exporta default; renderiza `LoginPage` ou `Dashboard` (Dashboard chega na Task 13 — até lá, um placeholder).

Sem teste automatizado nesta task (depende do popup do Google); verificação manual no final.

- [ ] **Step 1: Escrever `src/auth/googleAuth.ts`**

```ts
import { GOOGLE_CLIENT_ID, OAUTH_SCOPES, USERINFO_URL } from '../config';

export interface AuthUser {
  name: string;
  email: string;
  picture: string;
}

const SESSION_FLAG = 'yt-live:hasSession';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let expiresAt = 0;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar o Google Identity Services'));
    document.head.appendChild(s);
  });
}

export async function initAuth(): Promise<void> {
  if (tokenClient) return;
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado');
  await loadGis();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: OAUTH_SCOPES,
    callback: (resp) => {
      const p = pending;
      pending = null;
      if (resp.error) {
        p?.reject(new Error(resp.error_description ?? resp.error));
        return;
      }
      accessToken = resp.access_token;
      expiresAt = Date.now() + Number(resp.expires_in) * 1000;
      sessionStorage.setItem(SESSION_FLAG, '1');
      p?.resolve(resp.access_token);
    },
    error_callback: (err) => {
      const p = pending;
      pending = null;
      p?.reject(new Error(err.message || err.type));
    },
  });
}

function requestToken(prompt: '' | 'consent' | 'select_account'): Promise<string> {
  if (!tokenClient) return Promise.reject(new Error('Auth não inicializado'));
  if (pending) return Promise.reject(new Error('Já existe uma solicitação de login em andamento'));
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient!.requestAccessToken({ prompt });
  });
}

/** Login interativo (clique do usuário). */
export function signIn(): Promise<string> {
  return requestToken('');
}

/** Tenta renovar sem interação ao recarregar a página. */
export async function trySilentSignIn(): Promise<string | null> {
  if (sessionStorage.getItem(SESSION_FLAG) !== '1') return null;
  try {
    return await requestToken('');
  } catch {
    sessionStorage.removeItem(SESSION_FLAG);
    return null;
  }
}

export async function getValidToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt - EXPIRY_MARGIN_MS) return accessToken;
  return requestToken('');
}

export async function refreshToken(): Promise<string> {
  accessToken = null;
  return requestToken('');
}

export async function fetchUserInfo(token: string): Promise<AuthUser> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Não foi possível obter o perfil do usuário');
  const data = (await res.json()) as { name?: string; email?: string; picture?: string };
  return { name: data.name ?? '', email: data.email ?? '', picture: data.picture ?? '' };
}

export function signOut(): void {
  const t = accessToken;
  accessToken = null;
  expiresAt = 0;
  sessionStorage.removeItem(SESSION_FLAG);
  if (t && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(t, () => {});
  }
}
```

- [ ] **Step 2: Escrever `src/auth/useAuth.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  initAuth,
  signIn as gisSignIn,
  signOut as gisSignOut,
  trySilentSignIn,
  fetchUserInfo,
  type AuthUser,
} from './googleAuth';
import { clearLiveCaches } from '../lib/cache';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const token = await trySilentSignIn();
        if (cancelled) return;
        if (token) {
          setUser(await fetchUserInfo(token));
          setStatus('signedIn');
        } else {
          setStatus('signedOut');
        }
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const token = await gisSignIn();
      setUser(await fetchUserInfo(token));
      setStatus('signedIn');
    } catch (e) {
      setError(errorMessage(e));
      setStatus('signedOut');
    }
  }, []);

  const signOut = useCallback(() => {
    gisSignOut();
    clearLiveCaches();
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  return { status, user, error, signIn, signOut };
}
```

- [ ] **Step 3: Escrever `src/pages/LoginPage.tsx`**

```tsx
interface Props {
  onSignIn: () => void;
  error: string | null;
  loading: boolean;
}

export default function LoginPage({ onSignIn, error, loading }: Props) {
  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-yt-surface border border-yt-border p-8 text-center space-y-6">
        <div className="space-y-2">
          <div className="mx-auto h-14 w-14 rounded-full bg-yt-red flex items-center justify-center text-2xl">
            ▶
          </div>
          <h1 className="text-2xl font-semibold">Lives Agora</h1>
          <p className="text-yt-muted text-sm">
            Veja só o que está ao vivo agora nos canais que você segue.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={loading}
          className="w-full rounded-lg bg-white text-black font-medium py-3 hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Carregando…' : 'Entrar com Google'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <p className="text-xs text-yt-muted">
          Acesso somente leitura (youtube.readonly). Nenhum dado sai do seu navegador.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Substituir `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { configureClient } from './api/youtubeClient';
import { getValidToken, refreshToken } from './auth/googleAuth';
import './index.css';

configureClient({ getToken: getValidToken, refreshToken });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 5: Substituir `src/App.tsx` (Dashboard temporário)**

```tsx
import { useAuth } from './auth/useAuth';
import LoginPage from './pages/LoginPage';

export default function App() {
  const auth = useAuth();

  if (auth.status !== 'signedIn') {
    return (
      <LoginPage onSignIn={auth.signIn} error={auth.error} loading={auth.status === 'loading'} />
    );
  }

  return (
    <main className="p-6 space-y-4">
      <p>Logado como {auth.user?.name} ({auth.user?.email})</p>
      <button type="button" className="underline" onClick={auth.signOut}>
        Sair
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Configurar o Google Cloud e `.env`**

1. Acesse https://console.cloud.google.com → crie um projeto (ex.: "lives-agora").
2. **APIs e serviços → Biblioteca** → procure **YouTube Data API v3** → **Ativar**.
3. **APIs e serviços → Tela de permissão OAuth** → tipo **Externo** → preencha nome do app e e-mail de suporte → em **Escopos**, adicione `.../auth/youtube.readonly`, `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` → em **Usuários de teste**, adicione o seu e-mail. Mantenha o status **Em teste**.
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web** → em **Origens JavaScript autorizadas** adicione `http://localhost:5173` (e depois a URL de produção). Deixe **URIs de redirecionamento** vazio. Copie o **ID do cliente**.
5. Crie `.env` na raiz com `VITE_GOOGLE_CLIENT_ID=<id copiado>`.

- [ ] **Step 7: Verificação manual**

Run: `npm run build` → sem erros de TypeScript.
Run: `npm run dev` → abrir `http://localhost:5173`:
- Tela de login com botão "Entrar com Google".
- Clicar → popup do Google → escolher a conta de teste → consentir `youtube.readonly`.
- Página mostra "Logado como <nome> (<email>)".
- Recarregar a página (F5) → deve voltar logado sem popup (ou com popup rápido que fecha sozinho).
- Clicar "Sair" → volta ao login; F5 mantém deslogado.
Parar o servidor.

---

### Task 11: `hooks/useLives.ts`

**Files:**
- Create: `src/hooks/useLives.ts`

**Interfaces:**
- Consumes: `getSubscriptions`, `fetchLiveFromChannels`, `fetchDiscoverInitial`, `searchLive`, `cacheGet/cacheSet/CACHE_KEYS`, `Channel`, `LiveStream`, `Filters`.
- Produces:
  - `useSubscriptions(): UseQueryResult<Channel[]> & { reload(): Promise<void> }` — `reload` força `getSubscriptions(true)`.
  - `useSubscribedLives(channels: Channel[] | undefined): UseQueryResult<LiveStream[]>` — `dataUpdatedAt` reflete o cache.
  - `useDiscoverLives(subscribedIds: Set<string> | undefined): { query: UseQueryResult<LiveStream[]>; remoteSearch: UseMutationResult<LiveStream[], Error, Filters> }`.
  - Query keys: `['subscriptions']`, `['lives', 'subscribed']`, `['lives', 'discover']`.

- [ ] **Step 1: Escrever `src/hooks/useLives.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSubscriptions } from '../api/subscriptions';
import { fetchLiveFromChannels } from '../api/liveFromChannels';
import { fetchDiscoverInitial, searchLive } from '../api/discover';
import type { Channel, Filters, LiveStream } from '../api/types';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

export const QK = {
  subscriptions: ['subscriptions'] as const,
  subscribed: ['lives', 'subscribed'] as const,
  discover: ['lives', 'discover'] as const,
};

function cachedLives(key: string): { value: LiveStream[]; savedAt: number } | undefined {
  return cacheGet<LiveStream[]>(key) ?? undefined;
}

export function useSubscriptions() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QK.subscriptions,
    queryFn: () => getSubscriptions(),
  });
  const reload = async () => {
    const subs = await getSubscriptions(true);
    qc.setQueryData(QK.subscriptions, subs);
  };
  return { ...query, reload };
}

export function useSubscribedLives(channels: Channel[] | undefined) {
  const cached = cachedLives(CACHE_KEYS.livesSubscribed);
  return useQuery({
    queryKey: QK.subscribed,
    enabled: !!channels,
    initialData: cached?.value,
    initialDataUpdatedAt: cached?.savedAt,
    queryFn: async () => {
      const lives = await fetchLiveFromChannels(channels ?? []);
      cacheSet(CACHE_KEYS.livesSubscribed, lives);
      return lives;
    },
  });
}

export function useDiscoverLives(subscribedIds: Set<string> | undefined) {
  const qc = useQueryClient();
  const cached = cachedLives(CACHE_KEYS.livesDiscover);

  const query = useQuery({
    queryKey: QK.discover,
    enabled: !!subscribedIds,
    initialData: cached?.value,
    initialDataUpdatedAt: cached?.savedAt,
    queryFn: async () => {
      const lives = await fetchDiscoverInitial(subscribedIds ?? new Set());
      cacheSet(CACHE_KEYS.livesDiscover, lives);
      return lives;
    },
  });

  const remoteSearch = useMutation({
    mutationFn: (filters: Filters) => searchLive(filters, subscribedIds ?? new Set()),
    onSuccess: (lives) => {
      cacheSet(CACHE_KEYS.livesDiscover, lives);
      qc.setQueryData(QK.discover, lives);
    },
  });

  return { query, remoteSearch };
}
```

- [ ] **Step 2: Verificar tipagem**

Run: `npx tsc -b`
Expected: sem erros.

---

### Task 12: Componentes de UI

**Files:**
- Create: `src/components/Header.tsx`, `src/components/QuotaBadge.tsx`, `src/components/Tabs.tsx`, `src/components/FilterBar.tsx`, `src/components/LiveCard.tsx`, `src/components/LiveGrid.tsx`, `src/components/Banner.tsx`

**Interfaces:**
- Consumes: `LiveStream`, `Filters`, `CATEGORIES`, `LANGUAGES`, `REGIONS`, `categoryName`, `languageName`, `formatViewers`, `formatElapsed`, `getQuotaUsed`, `QUOTA_DAILY_LIMIT`, `AuthUser`.
- Produces (props):
  - `Header { user: AuthUser; quotaUsed: number; onReloadSubscriptions(): void; onSignOut(): void; reloadingSubs: boolean }`
  - `QuotaBadge { used: number }`
  - `Tabs { active: TabKey; counts: Record<TabKey, number>; onChange(t: TabKey): void }` com `export type TabKey = 'subscribed' | 'discover'`.
  - `FilterBar { filters: Filters; onChange(f: Filters): void; onRefresh(): void; refreshing: boolean; showRemoteSearch: boolean; onRemoteSearch?(): void; remoteSearching?: boolean; disabled?: boolean }`
  - `LiveCard { live: LiveStream }`
  - `LiveGrid { lives: LiveStream[]; loading: boolean; emptyMessage: string }`
  - `Banner { kind: 'error' | 'warning' | 'info'; children: ReactNode }`

- [ ] **Step 1: `src/components/QuotaBadge.tsx`**

```tsx
import { QUOTA_DAILY_LIMIT } from '../config';

export default function QuotaBadge({ used }: { used: number }) {
  const pct = Math.min(100, Math.round((used / QUOTA_DAILY_LIMIT) * 100));
  const color = pct >= 90 ? 'text-red-400' : pct >= 60 ? 'text-yellow-400' : 'text-yt-muted';
  return (
    <span
      className={`text-xs tabular-nums ${color}`}
      title="Estimativa de unidades da YouTube API usadas hoje (reset à meia-noite, horário do Pacífico)"
    >
      ~{used.toLocaleString('pt-BR')} / {QUOTA_DAILY_LIMIT.toLocaleString('pt-BR')}
    </span>
  );
}
```

- [ ] **Step 2: `src/components/Banner.tsx`**

```tsx
import type { ReactNode } from 'react';

const styles = {
  error: 'bg-red-950/60 border-red-800 text-red-200',
  warning: 'bg-yellow-950/60 border-yellow-800 text-yellow-100',
  info: 'bg-yt-surface border-yt-border text-yt-muted',
} as const;

export default function Banner({ kind, children }: { kind: keyof typeof styles; children: ReactNode }) {
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}
```

- [ ] **Step 3: `src/components/Header.tsx`**

```tsx
import { useState } from 'react';
import type { AuthUser } from '../auth/googleAuth';
import QuotaBadge from './QuotaBadge';

interface Props {
  user: AuthUser;
  quotaUsed: number;
  reloadingSubs: boolean;
  onReloadSubscriptions: () => void;
  onSignOut: () => void;
}

export default function Header({ user, quotaUsed, reloadingSubs, onReloadSubscriptions, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-yt-bg/95 backdrop-blur border-b border-yt-border">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
        <span className="h-7 w-7 rounded-full bg-yt-red flex items-center justify-center text-xs">▶</span>
        <h1 className="font-semibold text-lg">Lives Agora</h1>
        <div className="ml-auto flex items-center gap-3">
          <QuotaBadge used={quotaUsed} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="h-8 w-8 rounded-full overflow-hidden border border-yt-border"
              aria-label="Menu do usuário"
            >
              {user.picture ? (
                <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-sm">{user.name.charAt(0)}</span>
              )}
            </button>
            {open && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-lg bg-yt-surface border border-yt-border shadow-xl py-1 text-sm"
                onMouseLeave={() => setOpen(false)}
              >
                <div className="px-3 py-2 border-b border-yt-border">
                  <div className="font-medium truncate">{user.name}</div>
                  <div className="text-xs text-yt-muted truncate">{user.email}</div>
                </div>
                <button
                  type="button"
                  disabled={reloadingSubs}
                  onClick={() => {
                    setOpen(false);
                    onReloadSubscriptions();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-yt-border disabled:opacity-50"
                >
                  {reloadingSubs ? 'Recarregando inscrições…' : 'Recarregar inscrições'}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 hover:bg-yt-border text-red-300"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: `src/components/Tabs.tsx`**

```tsx
export type TabKey = 'subscribed' | 'discover';

interface Props {
  active: TabKey;
  counts: Record<TabKey, number>;
  onChange: (t: TabKey) => void;
}

const LABELS: Record<TabKey, string> = { subscribed: 'Inscritos', discover: 'Descoberta' };

export default function Tabs({ active, counts, onChange }: Props) {
  return (
    <nav className="flex gap-6 border-b border-yt-border px-4 mx-auto max-w-7xl" role="tablist">
      {(Object.keys(LABELS) as TabKey[]).map((key) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive ? 'border-white text-white' : 'border-transparent text-yt-muted hover:text-white'
            }`}
          >
            {LABELS[key]} <span className="text-yt-muted">({counts[key]})</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: `src/components/FilterBar.tsx`**

```tsx
import { useState } from 'react';
import type { Filters } from '../api/types';
import { CATEGORIES, LANGUAGES, REGIONS } from '../lib/categories';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onRefresh: () => void;
  refreshing: boolean;
  showRemoteSearch: boolean;
  onRemoteSearch?: () => void;
  remoteSearching?: boolean;
  disabled?: boolean;
}

const selectCls =
  'rounded-md bg-yt-surface border border-yt-border px-2 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed';

export default function FilterBar({
  filters,
  onChange,
  onRefresh,
  refreshing,
  showRemoteSearch,
  onRemoteSearch,
  remoteSearching = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const selects = (
    <>
      <select
        className={selectCls}
        value={filters.categoryId ?? ''}
        onChange={(e) => set({ categoryId: e.target.value || null })}
        aria-label="Categoria"
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={filters.language ?? ''}
        onChange={(e) => set({ language: e.target.value || null })}
        aria-label="Idioma"
      >
        <option value="">Todos os idiomas</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={filters.region ?? ''}
        onChange={(e) => set({ region: e.target.value || null })}
        disabled={!showRemoteSearch}
        title={
          showRemoteSearch
            ? 'Região só se aplica ao botão "Buscar no YouTube"'
            : 'Região só está disponível na aba Descoberta (busca remota)'
        }
        aria-label="Região"
      >
        <option value="">Todas as regiões</option>
        {REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="sticky top-14 z-20 bg-yt-bg/95 backdrop-blur border-b border-yt-border">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Buscar por título ou canal…"
          className="flex-1 min-w-[180px] rounded-md bg-yt-surface border border-yt-border px-3 py-2 text-sm"
          aria-label="Busca"
        />

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="sm:hidden rounded-md border border-yt-border px-3 py-2 text-sm"
        >
          Filtros
        </button>

        <div className="hidden sm:flex items-center gap-2">{selects}</div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || disabled}
          className="rounded-md bg-yt-surface border border-yt-border px-3 py-2 text-sm hover:bg-yt-border disabled:opacity-50"
        >
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>

        {showRemoteSearch && (
          <button
            type="button"
            onClick={onRemoteSearch}
            disabled={remoteSearching || disabled}
            className="rounded-md bg-yt-red px-3 py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
            title="Faz uma busca na API do YouTube com os filtros atuais (custa 100 unidades de cota)"
          >
            {remoteSearching ? 'Buscando…' : 'Buscar no YouTube'}{' '}
            <span className="text-xs opacity-80">100 un.</span>
          </button>
        )}

        {open && <div className="sm:hidden w-full flex flex-col gap-2 pt-1">{selects}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `src/components/LiveCard.tsx`**

```tsx
import type { LiveStream } from '../api/types';
import { categoryName, languageName } from '../lib/categories';
import { formatElapsed, formatViewers } from '../lib/format';

export default function LiveCard({ live }: { live: LiveStream }) {
  const href = `https://www.youtube.com/watch?v=${live.videoId}`;
  const lang = languageName(live.language);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden bg-yt-surface border border-yt-border hover:border-yt-muted transition-colors"
    >
      <div className="relative aspect-video bg-black">
        {live.thumbnailUrl && (
          <img
            src={live.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover group-hover:opacity-90"
          />
        )}
        <span className="absolute top-2 left-2 rounded bg-yt-red px-1.5 py-0.5 text-[11px] font-bold tracking-wide">
          AO VIVO
        </span>
        <div className="absolute bottom-2 right-2 flex gap-1 text-[11px]">
          {live.viewers !== undefined && (
            <span className="rounded bg-black/80 px-1.5 py-0.5">👁 {formatViewers(live.viewers)}</span>
          )}
          {live.startedAt && (
            <span className="rounded bg-black/80 px-1.5 py-0.5">⏱ {formatElapsed(live.startedAt)}</span>
          )}
        </div>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-medium leading-snug line-clamp-2" title={live.title}>
          {live.title}
        </h3>
        <p className="text-xs text-yt-muted truncate">{live.channelTitle}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="rounded-full bg-yt-border px-2 py-0.5 text-[11px]">{categoryName(live.categoryId)}</span>
          {lang && <span className="rounded-full bg-yt-border px-2 py-0.5 text-[11px]">{lang}</span>}
        </div>
      </div>
    </a>
  );
}
```

- [ ] **Step 7: `src/components/LiveGrid.tsx`**

```tsx
import type { LiveStream } from '../api/types';
import LiveCard from './LiveCard';

interface Props {
  lives: LiveStream[];
  loading: boolean;
  emptyMessage: string;
}

function Skeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-yt-surface border border-yt-border animate-pulse">
      <div className="aspect-video bg-yt-border" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-yt-border rounded w-11/12" />
        <div className="h-3 bg-yt-border rounded w-7/12" />
        <div className="h-3 bg-yt-border rounded w-4/12" />
      </div>
    </div>
  );
}

export default function LiveGrid({ lives, loading, emptyMessage }: Props) {
  if (loading && lives.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }
  if (lives.length === 0) {
    return <p className="text-center text-yt-muted py-16">{emptyMessage}</p>;
  }
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lives.map((l) => (
        <LiveCard key={l.videoId} live={l} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Verificar tipagem**

Run: `npx tsc -b`
Expected: sem erros (componentes ainda não usados — `noUnusedLocals` só reclama de locais, não de módulos não importados).

---

### Task 13: Páginas e Dashboard — `SubscribedTab`, `DiscoverTab`, `Dashboard`, `App`

**Files:**
- Create: `src/pages/SubscribedTab.tsx`, `src/pages/DiscoverTab.tsx`, `src/pages/Dashboard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 11 e 12; `applyFilters`; `formatAgo`; `QuotaExceededError`, `AuthError`; `getQuotaUsed`; `cacheGet/cacheSet/CACHE_KEYS`.
- Produces:
  - `SubscribedTab { channels: Channel[]; filters: Filters; onCount(n: number): void; onAuthError(): void }`
  - `DiscoverTab { subscribedIds: Set<string>; filters: Filters; onCount(n: number): void; onAuthError(): void; onRemoteSearchRef(fn: (() => void) | null): void }` — expõe a função de busca remota ao Dashboard.
  - Padrão de tratamento de erro compartilhado em `src/pages/errorBanner.tsx`: `errorToBanner(e: unknown): { kind: 'error' | 'warning'; text: string }`.

Para manter o `FilterBar` único (sticky sob as tabs) e as abas com seus próprios dados, o `Dashboard` é dono dos `filters` e do `activeTab`, e cada aba recebe `filters` por props e reporta contagem via `onCount`.

- [ ] **Step 1: `src/pages/errorBanner.tsx`**

```tsx
import { QuotaExceededError, AuthError } from '../api/youtubeClient';

export function errorToBanner(e: unknown): { kind: 'error' | 'warning'; text: string } {
  if (e instanceof QuotaExceededError) {
    return {
      kind: 'warning',
      text: 'Cota diária da YouTube API esgotada. Ela volta à meia-noite (horário do Pacífico). Mostrando o último resultado salvo.',
    };
  }
  if (e instanceof AuthError) {
    return { kind: 'error', text: e.message };
  }
  const msg = e instanceof Error ? e.message : 'Erro desconhecido';
  return { kind: 'error', text: `Falha ao consultar o YouTube: ${msg}. Tente atualizar novamente.` };
}
```

- [ ] **Step 2: `src/pages/SubscribedTab.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import type { Channel, Filters } from '../api/types';
import { AuthError } from '../api/youtubeClient';
import { useSubscribedLives } from '../hooks/useLives';
import { applyFilters } from '../lib/filters';
import { formatAgo } from '../lib/format';
import LiveGrid from '../components/LiveGrid';
import Banner from '../components/Banner';
import { errorToBanner } from './errorBanner';

interface Props {
  channels: Channel[];
  filters: Filters;
  onCount: (n: number) => void;
  onAuthError: () => void;
}

export default function SubscribedTab({ channels, filters, onCount, onAuthError }: Props) {
  const q = useSubscribedLives(channels);
  const filtered = useMemo(() => applyFilters(q.data ?? [], filters), [q.data, filters]);

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);
  useEffect(() => {
    if (q.error instanceof AuthError) onAuthError();
  }, [q.error, onAuthError]);

  const hasAny = (q.data?.length ?? 0) > 0;
  const emptyMessage = hasAny
    ? 'Nenhuma live corresponde aos filtros.'
    : q.data
      ? 'Nenhum canal inscrito está ao vivo agora.'
      : 'Clique em "Atualizar" para buscar as lives dos seus canais.';

  return (
    <div className="space-y-3">
      {q.error && <Banner kind={errorToBanner(q.error).kind}>{errorToBanner(q.error).text}</Banner>}
      {q.dataUpdatedAt > 0 && (
        <p className="text-xs text-yt-muted">
          {channels.length} canais inscritos · atualizado {formatAgo(q.dataUpdatedAt)}
        </p>
      )}
      <LiveGrid lives={filtered} loading={q.isFetching} emptyMessage={emptyMessage} />
    </div>
  );
}
```

- [ ] **Step 3: `src/pages/DiscoverTab.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import type { Filters } from '../api/types';
import { AuthError } from '../api/youtubeClient';
import { useDiscoverLives } from '../hooks/useLives';
import { applyFilters } from '../lib/filters';
import { formatAgo } from '../lib/format';
import LiveGrid from '../components/LiveGrid';
import Banner from '../components/Banner';
import { errorToBanner } from './errorBanner';

interface Props {
  subscribedIds: Set<string>;
  filters: Filters;
  onCount: (n: number) => void;
  onAuthError: () => void;
  onRemoteSearchRef: (fn: (() => void) | null, busy: boolean) => void;
}

export default function DiscoverTab({ subscribedIds, filters, onCount, onAuthError, onRemoteSearchRef }: Props) {
  const { query: q, remoteSearch } = useDiscoverLives(subscribedIds);
  const filtered = useMemo(() => applyFilters(q.data ?? [], filters), [q.data, filters]);

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  useEffect(() => {
    onRemoteSearchRef(() => remoteSearch.mutate(filters), remoteSearch.isPending);
    return () => onRemoteSearchRef(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, remoteSearch.isPending]);

  const error = q.error ?? remoteSearch.error;
  useEffect(() => {
    if (error instanceof AuthError) onAuthError();
  }, [error, onAuthError]);

  const hasAny = (q.data?.length ?? 0) > 0;
  const emptyMessage = hasAny
    ? 'Nenhuma live corresponde aos filtros. Tente "Buscar no YouTube".'
    : 'Nenhuma live encontrada. Clique em "Atualizar" ou "Buscar no YouTube".';

  return (
    <div className="space-y-3">
      {error && <Banner kind={errorToBanner(error).kind}>{errorToBanner(error).text}</Banner>}
      {q.dataUpdatedAt > 0 && (
        <p className="text-xs text-yt-muted">
          Lives populares de canais que você não segue · atualizado {formatAgo(q.dataUpdatedAt)}
        </p>
      )}
      <LiveGrid lives={filtered} loading={q.isFetching || remoteSearch.isPending} emptyMessage={emptyMessage} />
    </div>
  );
}
```

- [ ] **Step 4: `src/pages/Dashboard.tsx`**

```tsx
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
```

> Ambas as abas ficam montadas (uma oculta via `hidden`) para que as contagens das duas tabs existam e para que trocar de aba não refaça chamadas.

- [ ] **Step 5: Substituir `src/App.tsx`**

```tsx
import { useAuth } from './auth/useAuth';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

export default function App() {
  const auth = useAuth();

  if (auth.status !== 'signedIn' || !auth.user) {
    return (
      <LoginPage onSignIn={auth.signIn} error={auth.error} loading={auth.status === 'loading'} />
    );
  }

  return <Dashboard user={auth.user} onSignOut={auth.signOut} />;
}
```

- [ ] **Step 6: Build e verificação manual**

Run: `npx tsc -b && npm test`
Expected: sem erros de tipo; todos os testes passam.

Run: `npm run dev` e verificar no navegador:
1. Login → Dashboard carrega "Carregando suas inscrições…" e depois a aba Inscritos com o cache vazio e mensagem "Clique em Atualizar…". Badge de cota mostra ~N (N = páginas de inscrições).
2. Clicar **Atualizar** → skeletons → cards das lives dos inscritos (ou "Nenhum canal inscrito está ao vivo agora"). Badge de cota sobe ~(nº de canais + lotes).
3. Digitar na busca / trocar categoria / idioma → filtra na hora, sem mudar a cota. Select de Região desabilitado.
4. Aba **Descoberta** → primeira vez: skeleton, ~505 unidades, cards de canais não inscritos. Região habilitada.
5. Escolher Região = Japão, Categoria = Música, clicar **Buscar no YouTube** → lista substituída, +101 unidades.
6. F5 → dados voltam do cache sem chamadas (cota não muda); "atualizado há X min" aparece.
7. Menu do avatar → Recarregar inscrições → cota sobe ~N. Sair → LoginPage.
8. Redimensionar para < 640px → selects colapsam no botão "Filtros"; grid vira 1 coluna.
Parar o servidor.

---

### Task 14: PWA, README e deploy

**Files:**
- Create: `public/icon.svg`, `README.md`
- Modify: `vite.config.ts`, `index.html`
- Generated: `public/pwa-64x64.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico`

**Interfaces:**
- Produces: build com service worker (`dist/sw.js`) e `manifest.webmanifest` instalável no celular; README com setup do Google Cloud e deploy.

- [ ] **Step 1: Criar `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f0f0f"/>
  <circle cx="256" cy="256" r="150" fill="#ff0000"/>
  <polygon points="215,180 215,332 345,256" fill="#ffffff"/>
</svg>
```

- [ ] **Step 2: Gerar os ícones PNG**

Run: `npm run icons`
Expected: arquivos `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico` criados em `public/`.

- [ ] **Step 3: Atualizar `vite.config.ts` com o plugin PWA**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Lives Agora',
        short_name: 'Lives',
        description: 'Transmissões ao vivo dos canais que você segue, agora.',
        lang: 'pt-BR',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // Nunca cachear Google APIs / GIS: sem runtimeCaching e fora do precache.
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
});
```

- [ ] **Step 4: Adicionar ícones ao `index.html`**

Dentro de `<head>`, após a tag `<meta name="theme-color" ...>`:
```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 5: Escrever `README.md`**

````markdown
# Lives Agora

Painel pessoal (PWA) que mostra **somente transmissões ao vivo acontecendo agora** no YouTube, em duas abas:

- **Inscritos** — lives dos canais em que você é inscrito.
- **Descoberta** — lives populares de canais que você não segue.

Filtros locais por categoria, idioma e texto; busca remota opcional com região. Sem backend: tudo roda no navegador com o seu token Google.

## Stack

Vite · React 18 · TypeScript · Tailwind · TanStack Query · Google Identity Services · vite-plugin-pwa · Vitest

## 1. Configurar o Google Cloud

1. Crie um projeto em <https://console.cloud.google.com>.
2. **APIs e serviços → Biblioteca** → ative **YouTube Data API v3**.
3. **Tela de permissão OAuth** → tipo *Externo* → preencha nome e e-mail → **Escopos**: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `https://www.googleapis.com/auth/youtube.readonly` → **Usuários de teste**: adicione o seu e-mail. Mantenha em *Em teste*.
4. **Credenciais → Criar credenciais → ID do cliente OAuth** → *Aplicativo da Web* → **Origens JavaScript autorizadas**: `http://localhost:5173` e a URL de produção (ex.: `https://lives-agora.vercel.app`). Sem URIs de redirecionamento.
5. Copie o **ID do cliente**.

> Em modo *Em teste* a sessão expira a cada 7 dias; basta logar de novo.

## 2. Rodar localmente

```bash
cp .env.example .env   # e preencha VITE_GOOGLE_CLIENT_ID
npm install
npm run dev            # http://localhost:5173
npm test
```

## 3. Deploy (Vercel)

1. Suba o repositório no GitHub e importe no Vercel (framework: Vite).
2. Em *Environment Variables*, adicione `VITE_GOOGLE_CLIENT_ID`.
3. Depois do primeiro deploy, adicione a URL final nas *Origens JavaScript autorizadas* do Google Cloud.
4. No celular, abra a URL e use "Adicionar à tela inicial".

Netlify funciona igual (build `npm run build`, publish `dist`).

## Cota da YouTube API

10.000 unidades/dia. `search.list` custa 100; os demais 1. O badge no topo mostra a estimativa do dia.

| Ação | Custo aproximado |
|---|---|
| Carregar inscrições (500 canais) | 10 |
| Atualizar aba Inscritos (500 canais) | ~550 |
| Primeira carga da Descoberta | ~505 |
| Buscar no YouTube | ~101 |

## Estrutura

```
src/
  auth/        Google Identity Services (token em memória)
  api/         YouTube Data API v3 (cliente, inscrições, vídeos, descoberta)
  lib/         funções puras: cache, cota, filtros, formatação
  hooks/       TanStack Query
  components/  UI
  pages/       Login e Dashboard
```
````

- [ ] **Step 6: Build e verificação final**

Run: `npm run build`
Expected: `dist/sw.js`, `dist/manifest.webmanifest`, `dist/workbox-*.js` gerados; sem erros.

Run: `npm run preview` → abrir `http://localhost:4173`:
- DevTools → Application → Manifest: nome "Lives Agora", ícones carregados, sem erros.
- Application → Service Workers: registrado e ativo.
- Network: chamadas a `googleapis.com` vêm da rede (não "from ServiceWorker").
- Login e fluxo completo funcionam igual ao `dev` (adicione `http://localhost:4173` às Origens JavaScript autorizadas se quiser testar login no preview).
Parar o servidor.

Run: `npm test`
Expected: todos passam.

---

## Self-review

**Spec coverage:**
- §4 Stack → Task 1. §5 Estrutura → Tasks 1–13 (arquivo extra `api/videos.ts`, `lib/concurrency.ts`, `lib/format.ts`, `hooks/useLives.ts`, `pages/Dashboard.tsx`, `pages/errorBanner.tsx`, `components/Banner.tsx` — refinamentos da mesma responsabilidade, sem mudar as fronteiras do spec).
- §6 Google Cloud e auth → Task 10 (+ README Task 14). Erros 401/403/rede/404 → Tasks 6, 8, 13.
- §7 Modelo de dados → Task 2; categorias/idiomas/regiões → Task 4.
- §8 Fluxo Inscritos → Tasks 7, 8, 11. Descoberta + busca remota → Tasks 9, 11. Filtros locais → Task 4. Cota → Tasks 3, 6, 12 (badge).
- §9 UI → Tasks 12, 13. §10 Testes → Tasks 2–9. §11 PWA/deploy/README → Task 14.
- Spec §10 menciona msw; o plano usa `vi.fn` sobre `fetch`/`ytGet` — mesma cobertura, menos dependências.

**Placeholders:** nenhum TBD/TODO; todos os passos com código.

**Type consistency:** `ytGet(resource, params)` idem nas Tasks 6–9; `fetchLiveVideos(ids, subscribedIds)` idem em 8–9; `cacheGet/cacheSet/CACHE_KEYS` idem em 2, 7, 11, 13; `TabKey` definido em 12 e usado em 13; `AuthUser` de `googleAuth.ts` usado em 12–13; `QK` exportado em 11 e usado em 13; `onRemoteSearchRef(fn, busy)` com dois argumentos em DiscoverTab e Dashboard.
