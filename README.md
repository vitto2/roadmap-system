# Trilha Sênior

Roadmap interativo e gamificado para estudar programação até o nível **sênior**. Você marca os tópicos que já
estudou, cumpre projetos desafio por etapas, revisa o que aprendeu (revisão espaçada) e acumula **XP**.
Interface em português do Brasil, roda **na web** e guarda tudo no **Supabase** (Postgres + login).

- **10 trilhas** (Fundamentos, Web base, Vue, PHP/Laravel, SQL, Qualidade, Arquitetura, DevOps, Segurança, Carreira),
  com 138 tópicos organizados por nível de carreira, cada um com checklist "como sei que dominei" e recursos oficiais.
- **11 projetos desafio** do júnior ao sênior, com etapas, critérios de aceite e XP.
- **Revisões** em 7, 30 e 90 dias, **diário de estudo**, streak, meta semanal, **dashboard** e **grafo de pré-requisitos**.
- Backup/restauração do progresso (JSON) e exportação do portfólio de projetos (markdown).
- Tema claro/escuro, responsivo, acessibilidade básica.

## Como funciona

```
 Navegador (Vue 3 + Vite, site estático)
        │  supabase-js (HTTPS)
        ▼
 Supabase ─ Auth (e-mail + senha)
          └ Postgres ─ tabelas no esquema "app" (conteúdo + progresso, com RLS por usuário)
                     └ funções RPC no esquema "public" (todas as regras: XP, níveis, carreira, revisões, streak)
```

- **As regras vivem no banco (SQL)**: o front-end só exibe o que o servidor calcula. XP é sempre *derivado* do estado
  (desmarcar ou reabrir algo desfaz o XP).
- **Conteúdo × progresso separados**: o conteúdo vem de `content/*.json` e é carregado de forma idempotente
  (`app.sync_content`, upsert pelo slug). O que sumir do JSON é *arquivado*, nunca apagado, e o seu progresso fica intacto.
- **Cada usuário só enxerga o próprio progresso** (RLS). A chave `anon` do Supabase é pública por design: a segurança é o
  login + RLS + permissões das funções (`anon` não executa nada).

```
supabase/migrations/   schema, RLS e funções SQL (compatível com a CLI do Supabase)
supabase/seed.sql      conteúdo (gerado de content/); idempotente
supabase/local/        stub do Supabase para rodar o SQL em PGlite (testes e modo demo)
content/               trilhas, tópicos, projetos e pré-requisitos (JSON)
tools/                 validação do conteúdo, gerador do seed, aplicação no banco e testes do SQL
frontend/              SPA Vue 3 (TypeScript estrito, Pinia, Tailwind)
```

## Pré-requisitos

- **Node.js 22.18+** (ou 24) e npm
- Uma conta **gratuita** no [Supabase](https://supabase.com)
- Para publicar: uma conta no Vercel, Netlify, Cloudflare Pages ou GitHub Pages (opcional)

> Quer só ver o app funcionando? Pule para [Modo demo](#modo-demo-sem-supabase).

## Passo a passo (do zero até o ar)

### 1. Crie o projeto no Supabase

1. Em supabase.com, **New project**. Escolha a região mais próxima e **anote a senha do banco**.
2. Use um projeto **dedicado** a este app (as migrations criam funções no esquema `public`).
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.

### 2. Prepare o banco (migrations + conteúdo)

**Opção A — um comando (recomendada).** No Supabase, clique em **Connect** e copie a string do **Session pooler**
(funciona em redes só IPv4; a "Direct connection" usa IPv6). Troque `[YOUR-PASSWORD]` pela senha do banco
(use `%40` para `@`, `%23` para `#` etc.).

```bash
cd tools
npm install
cp .env.example .env     # cole a string em DATABASE_URL
npm run db:setup
```

O `db:setup` aplica as migrations pendentes e carrega o conteúdo. Pode rodar de novo quando quiser (é idempotente).

**Opção B — pelo painel.** Em **SQL Editor**, rode, **nesta ordem**, o conteúdo de cada arquivo de
`supabase/migrations/` (`..._schema.sql`, `..._helpers.sql`, `..._content_sync.sql`, `..._read_models.sql`,
`..._actions.sql`, `..._api.sql`) e por último `supabase/seed.sql`. (Se o editor reclamar do tamanho do seed, use a
opção A.)

### 3. Crie o seu usuário

Em **Authentication → Users → Add user**, informe e-mail e senha (marque *Auto Confirm User*). Pronto: é com ela que você
vai entrar. Depois, em **Authentication → Sign In / Providers**, desative **Allow new users to sign up** (é um app
pessoal; os nomes exatos no painel podem variar com a versão). Se preferir criar a conta pela própria tela de login,
deixe os cadastros ligados só até o primeiro acesso.

### 4. Conecte o front-end e rode

```bash
cd frontend
npm install
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev              # http://localhost:5173
```

Entre com o usuário do passo 3 e marque o primeiro tópico: o XP no topo deve subir.

### 5. Publique na web (site estático)

O front-end é só HTML/JS: qualquer hospedagem estática serve. Em todas, configure as variáveis
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (e, se quiser, `VITE_ALLOW_SIGNUP=false`) **antes do build** — elas são
embutidas no site na hora do build.

| Hospedagem | Como |
| --- | --- |
| **Vercel** | *Add New → Project* → importe o repositório → **Root Directory:** `frontend` (já tem `vercel.json`). |
| **Netlify** | *Add new site → Import from Git* → o `netlify.toml` na raiz já define base, build e publish. |
| **Cloudflare Pages** | Build command `npm run build`, **root directory** `frontend`, output `dist` (`public/_redirects` trata as rotas). |
| **GitHub Pages** | *Settings → Pages → Source: GitHub Actions*; crie as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em *Settings → Secrets and variables → Actions → Variables*; rode **Actions → Publicar no GitHub Pages**. |

Depois de publicar, em **Authentication → URL Configuration** do Supabase, ponha o endereço do seu site em **Site URL**
(usado nos e-mails de confirmação).

## Modo demo (sem Supabase)

```bash
cd frontend
npm install
npm run dev:demo         # http://localhost:5173
```

Roda o **mesmo SQL** (migrations + conteúdo) dentro do navegador, num Postgres em WebAssembly ([PGlite](https://pglite.dev)).
Os dados ficam só naquele navegador (IndexedDB). Serve para experimentar e para testar o front-end de ponta a ponta. O
build de produção **não** inclui o modo demo.

## Atualizar o conteúdo

Edite os JSON em `content/` e rode, em `tools/`:

```bash
npm run content:validate   # formato e integridade (slugs, pré-requisitos, ciclos, projetos)
npm run content:build      # regenera supabase/seed.sql
npm run db:seed            # carrega no banco (ou cole supabase/seed.sql no SQL Editor)
npm run content:check-urls # confere se os links dos recursos ainda respondem (rede)
```

Não troque o `slug` de um tópico/projeto nem a `key` de um item/etapa que já existe: é por eles que o progresso se liga ao
conteúdo. O que você remover dos JSON some da interface, mas o progresso continua guardado (arquivado).

### Adicionar um tópico

Em `content/topics/<trilha>.json`:

```json
{
  "slug": "php-meu-novo-topico",
  "title": "Meu novo tópico",
  "description": "O que é, por que importa e o escopo.",
  "level": "mid",
  "difficulty": 3,
  "prerequisites": ["php-poo"],
  "resources": [{ "name": "Documentação oficial", "url": "https://laravel.com/docs" }, { "name": "Livro X" }],
  "checklist": [
    { "key": "explicar-conceito", "text": "Consigo explicar o conceito com minhas palavras." },
    { "key": "aplicar-exemplo", "text": "Já apliquei em um exemplo real." },
    { "key": "reconhecer-erros", "text": "Sei reconhecer os erros mais comuns." }
  ]
}
```

`level`: `beginner | junior | mid | senior`. `difficulty` (1–5) define o XP (`dificuldade × 10`). Pré-requisitos entre
trilhas ficam em `content/cross-prerequisites.json`. **Projetos**: `content/projects/*.json` (título, descrição, `level`,
`difficulty`, `topics` relacionados e 4–6 `milestones` com `key`, `title`, `acceptanceCriteria[]` e `xp` de 15 a 60).

## Regras de pontuação

Calculadas **no banco** (`supabase/migrations`); o front-end só exibe.

| Evento | XP |
| --- | --- |
| Tópico concluído | dificuldade × 10 (10 a 50) |
| Etapa de projeto concluída | definido na etapa (15 a 60) |
| Projeto finalizado (todas as etapas concluídas) | +100 (+50 com repositório, +50 com deploy) |
| Revisão espaçada concluída | 25% do XP do tópico (arredondado) |
| Nível N (gamificação) | 100 × N^1,5 XP para completar o nível (começa no nível 1) |

Concluir um tópico exige o checklist completo; **"Já domino"** marca tudo e agenda só a revisão de 90 dias. Quebrar o
streak não tira XP. O nível de carreira (Iniciante → Sênior) exige 40% / 60% / 80% de progresso nas trilhas obrigatórias
(Carreira é opcional). Datas ficam em UTC; streak, meta semanal e revisões usam o fuso configurado (padrão
`America/Sao_Paulo`).

## Testes e qualidade

```bash
cd tools    && npm test && npm run lint && npm run format:check && npm run typecheck
cd frontend && npm test && npm run lint && npm run format:check && npm run type-check
```

- `tools` roda as migrations, as funções, a RLS e as permissões num Postgres real em WebAssembly (PGlite): regras de
  XP/nível/carreira/revisão/streak, isolamento entre usuários, contrato JSON e carga idempotente do conteúdo.
- `frontend` testa stores, componentes, o cliente do Supabase (com `supabase-js` simulado) e roda **a API do front contra o
  SQL real** (modo demo em memória).
- O CI (`.github/workflows/ci.yml`) executa tudo a cada push/PR.

## Segurança

- A chave `anon` e a URL do projeto vão no front-end — isso é normal. **Nunca** use a `service_role` nem a string de
  conexão do banco (`DATABASE_URL`) no front-end ou no repositório: a `DATABASE_URL` só existe em `tools/.env` (ignorado pelo git).
- O acesso é sempre por login; `anon` não executa nenhuma função e as tabelas têm RLS (cada usuário vê só o que é seu).
- Markdown das notas é sempre sanitizado (markdown-it sem HTML + DOMPurify).

## Solução de problemas

| Sintoma | O que fazer |
| --- | --- |
| Tela "Falta conectar o Supabase" | Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e refaça o build/reinicie. |
| "O banco ainda não foi preparado" | As migrations não foram aplicadas neste projeto: rode `npm run db:setup` em `tools/`. |
| `db:setup` não conecta / `ENETUNREACH` | Use a string do **Session pooler** (IPv4) em vez da Direct connection. |
| "E-mail ou senha incorretos" | Confira o usuário em Authentication → Users; marque *Auto Confirm* ao criar. |
| "Confirme seu e-mail" | O projeto exige confirmação: confirme pelo e-mail ou desative *Confirm email* no provedor de e-mail. |
| "Sua sessão expirou" | Entre de novo (o token vence e o app volta para o login sozinho). |
| Conteúdo desatualizado | Rode `npm run db:seed` em `tools/` depois de mudar `content/`. |

Backups do app anterior (versão com SQLite) têm o mesmo formato e podem ser restaurados em **Configurações → Restaurar backup**.
