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

10.000 unidades/dia. `search.list` custa 100; os demais 1. O badge no topo mostra a estimativa do dia e o nº de buscas.

> **Atenção:** além das unidades, o Google tem um limite **separado** para `search.list` ("Search Queries per day"), que em projetos novos pode ser bem menor que 100/dia. Veja em *APIs e serviços → YouTube Data API v3 → Cotas e limites do sistema* e peça aumento se necessário. Cada carga/atualização da Descoberta consome 8 buscas; um continente no "Buscar no YouTube" consome 2–3.

| Ação | Custo aproximado |
|---|---|
| Carregar inscrições (500 canais) | 10 |
| Atualizar aba Inscritos (500 canais) | ~550 |
| Primeira carga da Descoberta (BR/pt e US/en × 3 categorias + global × 2) | ~801 |
| Atualizar aba Descoberta | ~801 |
| Buscar no YouTube (país ou sem região) | ~101 |
| Buscar no YouTube (continente = 2–3 países) | ~201–301 |

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
