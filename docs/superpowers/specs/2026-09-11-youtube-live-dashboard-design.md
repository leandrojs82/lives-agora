# YouTube Live Dashboard — Design

**Data:** 2026-09-11
**Status:** aprovado pelo usuário (brainstorming)

## 1. Objetivo

Painel web responsivo (PWA) de uso pessoal onde o usuário faz login com a conta Google/YouTube e vê **somente transmissões ao vivo acontecendo agora**, separadas em duas abas:

- **Inscritos** — lives dos canais em que o usuário é inscrito.
- **Descoberta** — lives populares de canais em que o usuário **não** é inscrito.

Com filtros locais (categoria, idioma, busca por texto) e busca remota opcional ("Buscar no YouTube") que aceita também região.

## 2. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Plataforma | Web responsiva / PWA | Um codebase para desktop e celular |
| Escala | 1 usuário (pessoal) | Cota de 10.000 un./dia é só do usuário; sem banco, sem cache compartilhado |
| Inscrições | 100–500 canais | Inviabiliza `search.list` por canal (100 un. cada); usa `playlistItems` + `videos.list` (~1 un./canal) |
| Filtros | Híbrido: locais por padrão + botão explícito "Buscar no YouTube" | Uso diário sem gastar cota; busca ampla sob demanda |
| Atualização | Somente manual (botão Atualizar) | Previsível, zero cota em background |
| Hospedagem | Estático com HTTPS (Vercel/Netlify) | Necessário para PWA no celular |
| Arquitetura | SPA pura, sem backend | Para 1 usuário o backend não compensa; sessão expira em 7 dias de qualquer forma (modo Testing) |

## 3. Restrições da YouTube Data API v3 que moldam o design

- Cota: 10.000 unidades/dia por projeto Google Cloud, reset à meia-noite no horário do Pacífico.
- Custos: `search.list` = 100; `subscriptions.list`, `playlistItems.list`, `videos.list`, `channels.list` = 1 cada (por página/lote).
- `liveBroadcasts.list` retorna apenas transmissões **do próprio usuário** — não é usado.
- Não existe endpoint de "recomendados". Descoberta = `search.list eventType=live order=viewCount`.
- A API **não informa o país** de um vídeo. `regionCode` existe só como parâmetro de `search.list`. Logo, filtro de Região só se aplica à busca remota; localmente, o proxy é o filtro de Idioma.
- Playlist de uploads de um canal é derivada sem chamada: `channelId "UC..."` → `"UU" + channelId.slice(2)`.
- Modo Testing no Google Cloud: sessão expira a cada 7 dias (o usuário precisa logar de novo). Aceito.

## 4. Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- TanStack Query (estado de fetch, `staleTime: Infinity`; invalidação só pelo botão Atualizar)
- Google Identity Services (GIS) — fluxo de token no navegador (`initTokenClient`)
- vite-plugin-pwa (service worker só para assets estáticos; nunca cacheia respostas da API)
- Vitest + msw (testes)
- Deploy: Vercel ou Netlify, env `VITE_GOOGLE_CLIENT_ID`

## 5. Estrutura de pastas

```
youtubelive/
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── main.tsx                 # bootstrap React + QueryClientProvider
│   ├── App.tsx                  # LoginPage | Dashboard conforme status de auth
│   ├── config.ts                # CLIENT_ID, escopos, custos de cota por endpoint
│   ├── auth/
│   │   ├── googleAuth.ts        # wrapper GIS: getValidToken(), signIn(), signOut()
│   │   └── useAuth.ts           # hook: { user, status, signIn, signOut }
│   ├── api/
│   │   ├── youtubeClient.ts     # fetch com Bearer, 401 retry, 403 quota, contador de cota
│   │   ├── subscriptions.ts     # lista todas as inscrições (paginação)
│   │   ├── liveFromChannels.ts  # uploads playlist → videos.list → filtra "live"
│   │   ├── discover.ts          # search.list eventType=live + enriquecimento
│   │   └── types.ts             # LiveStream, Channel, Filters
│   ├── lib/
│   │   ├── cache.ts             # localStorage com TTL
│   │   ├── filters.ts           # funções puras de filtro/ordenação
│   │   ├── quota.ts             # estimativa diária (chave por dia, fuso Pacífico)
│   │   └── categories.ts        # videoCategoryId → nome; listas de idiomas e regiões
│   ├── components/
│   │   ├── Header.tsx           # título, QuotaBadge, avatar/menu
│   │   ├── Tabs.tsx
│   │   ├── FilterBar.tsx
│   │   ├── LiveGrid.tsx
│   │   ├── LiveCard.tsx
│   │   └── QuotaBadge.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── SubscribedTab.tsx
│       └── DiscoverTab.tsx
├── .env.example
├── vite.config.ts
└── README.md                    # inclui passo a passo do Google Cloud
```

Regras de isolamento: `api/*` não importa React; `lib/*` são funções puras; componentes recebem dados por props/hooks.

## 6. Autenticação

### Google Cloud Console
1. Criar projeto → APIs e serviços → Biblioteca → ativar **YouTube Data API v3**.
2. Tela de consentimento OAuth: tipo Externo, modo Testing, adicionar o próprio e-mail como test user. Escopos: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/youtube.readonly`.
3. Credenciais → ID do cliente OAuth → Aplicativo da Web. Origens JavaScript autorizadas: `http://localhost:5173` e a URL de produção. Sem URIs de redirecionamento (fluxo por popup).
4. Sem API key (todas as chamadas usam o token do usuário).

### Fluxo no app (`auth/googleAuth.ts`)
- Carrega `https://accounts.google.com/gsi/client`; `google.accounts.oauth2.initTokenClient({ client_id, scope, callback })`.
- `signIn()` → `requestAccessToken()` (popup na 1ª vez; depois `prompt: ''` para renovação silenciosa).
- Access token e `expiresAt` ficam **só em memória**. `sessionStorage` guarda apenas o flag `hasSession` para tentar renovação silenciosa ao recarregar.
- `getValidToken()`: se faltar < 2 min para expirar, renova antes.
- Perfil via `GET https://www.googleapis.com/oauth2/v3/userinfo`.
- `signOut()` → `google.accounts.oauth2.revoke(token)`; limpa memória, sessionStorage e caches de lives (mantém cache de inscrições).

### Erros
| Situação | Comportamento |
|---|---|
| `403 quotaExceeded` | Banner "Cota diária esgotada — volta à meia-noite (horário do Pacífico)"; botões de refresh desabilitados; mostra último cache |
| `401` | Renova token uma vez e repete; se falhar, `signOut()` + LoginPage com mensagem |
| Rede / 5xx | Toast; mantém dados atuais; retry manual |
| Playlist `UU` inexistente (404) | Ignora o canal silenciosamente |

## 7. Modelo de dados

```ts
interface Channel { id: string; title: string; thumbnailUrl: string }

interface LiveStream {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  categoryId: string;      // "20" Gaming, "10" Music, ...
  language?: string;       // snippet.defaultAudioLanguage ?? snippet.defaultLanguage
  viewers?: number;        // liveStreamingDetails.concurrentViewers
  startedAt: string;       // liveStreamingDetails.actualStartTime
  isSubscribed: boolean;
}

interface Filters {
  categoryId: string | null;
  region: string | null;   // ISO 3166-1 alpha-2; só na busca remota
  language: string | null; // prefixo ISO 639-1 ("pt" casa "pt-BR", "pt-PT")
  query: string;
}
```

Categorias oferecidas (IDs fixos da API): Jogos 20, Música 10, Notícias 25, Educação 27, Esportes 17, Entretenimento 24, Ciência e Tecnologia 28, Pessoas e Blogs 22.
Idiomas: Todos, pt, en, es, ja, ko, fr, de, ru.
Regiões (busca remota): BR, US, PT, ES, MX, AR, GB, JP, KR, FR, DE.

## 8. Fluxo de dados

### Aba Inscritos
1. `subscriptions.ts`: `subscriptions.list?mine=true&part=snippet&maxResults=50`, pagina até o fim. Cache `subs:v1` (TTL 24h). "Recarregar inscrições" no menu força.
2. `liveFromChannels.ts`: para cada canal, `playlistItems.list?playlistId=UU…&part=contentDetails&maxResults=5` (1 un.). Concorrência limitada a 8 em paralelo. Junta todos os `videoId`.
3. `videos.list?id=…50 ids…&part=snippet,liveStreamingDetails` em lotes de 50 (1 un./lote). Mantém só `snippet.liveBroadcastContent === "live"`.
4. Resultado → TanStack Query (`staleTime: Infinity`) + cache `lives:subscribed` com timestamp.

### Aba Descoberta
1. Carga inicial (só se não houver cache): `search.list?part=snippet&eventType=live&type=video&order=viewCount&maxResults=50&videoCategoryId=X` para 5 categorias (Jogos, Música, Notícias, Esportes, Entretenimento) = 500 un.
2. `videos.list` para os ids (enriquece viewers/idioma/categoria) = ~5 un.
3. Remove `channelId` presente nas inscrições. Cache `lives:discover`.
4. **Buscar no YouTube**: `search.list` com os filtros atuais (`q`, `videoCategoryId`, `regionCode`, `relevanceLanguage`) = 100 un. + `videos.list` 1 un. Substitui a lista da aba.

### Filtros locais (`lib/filters.ts`)
- Categoria: igualdade de `categoryId`.
- Idioma: `language?.toLowerCase().startsWith(filter)`; lives sem idioma são mantidas.
- Busca: `title` ou `channelTitle` contém `query`, sem distinção de caixa/acento (`normalize("NFD")` + remoção de diacríticos).
- Ordenação: `viewers` desc, depois `startedAt` desc.
- Região: desabilitado localmente (tooltip explica); ativo apenas para "Buscar no YouTube".

### Cota (`lib/quota.ts`)
`youtubeClient.ts` soma custo por endpoint (tabela em `config.ts`) na chave `quota:YYYY-MM-DD` (data no fuso America/Los_Angeles). `QuotaBadge` mostra "~X / 10.000".

Estimativa pior caso (500 canais): inscrições 10; refresh Inscritos ~550; Descoberta inicial ~505; cada busca remota ~101.

## 9. Interface

Mobile-first, tema escuro padrão.

- **Header** fixo: título, `QuotaBadge`, avatar com menu (Recarregar inscrições, Sair).
- **Tabs**: "Inscritos (N)" | "Descoberta (N)", N = contagem após filtros. Aba ativa persiste em `localStorage`.
- **FilterBar** sticky: busca, selects Categoria / Idioma / Região, botão **Atualizar**; na Descoberta, botão **Buscar no YouTube** com badge "100 un.". Em telas estreitas os selects colapsam em botão "Filtros" que abre um sheet.
- **LiveGrid**: 1 coluna (mobile) → 2 (tablet) → 3–4 (desktop). Skeleton na carga. Estados vazios com mensagem específica.
- **LiveCard**: thumbnail 16:9, badge "AO VIVO", overlay de viewers e tempo desde `startedAt`; título (2 linhas), canal, chips de categoria e idioma. Clique abre `https://www.youtube.com/watch?v=<id>` em nova aba.
- Banners de erro/cota acima do grid; "Atualizado há X min" discreto.

## 10. Testes

Vitest + msw:
- `lib/filters.ts`: categoria, idioma (prefixo, ausente mantido), busca sem acento, ordenação.
- `lib/quota.ts`: soma por endpoint, chave por dia.
- `lib/cache.ts`: TTL expira, sem TTL persiste.
- `api/liveFromChannels.ts`: derivação UC→UU, batching de 50, filtro "live", 404 de playlist ignorado.
- `api/discover.ts`: remoção de inscritos, montagem de parâmetros da busca remota.
- `api/youtubeClient.ts`: 401 → renova e repete; 403 quota → erro tipado.

Sem testes e2e de UI (validação manual).

## 11. Deploy e PWA

- `npm run build` → Vercel/Netlify (Vite detectado). Env `VITE_GOOGLE_CLIENT_ID`.
- `vite-plugin-pwa`: manifest (nome, ícones 192/512, `display: standalone`, tema escuro), service worker com precache dos assets; `googleapis.com` e `accounts.google.com` excluídos do cache.
- README: passos do Google Cloud (seção 6), variáveis de ambiente, scripts.

## 12. Fora de escopo

Notificações push, múltiplos usuários, favoritos, inscrever/desinscrever, player embutido, backend, atualização automática, verificação do app no Google.
