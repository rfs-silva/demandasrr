# Demandas RR — Sistema de Gestão de Solicitações

Aplicação web full-stack, containerizada e production-ready para gestão de
demandas/solicitações por área de atendimento em Roraima.

> Stack: **FastAPI (async) · React 18 + Vite + TypeScript · PostgreSQL 16 · MinIO · Nginx · Docker Compose**

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2
- ~2 GB de RAM livre

## Subir a aplicação

```bash
# Criar o .env na raiz do projeto (ver "Variáveis de ambiente" abaixo)
docker compose up -d --build
```

A aplicação fica disponível em:

| URL | Descrição |
|-----|-----------|
| http://localhost | Frontend (React PWA) |
| http://localhost/api/v1 | API REST (prefixo) |
| http://localhost/api/docs | Swagger / OpenAPI |
| http://localhost/api/v1/health | Healthcheck |

## Credenciais iniciais (seed automático)

No primeiro `up`, o backend cria:

- 15 municípios de Roraima + opção **Outros**
- Usuário **administrador root** (definido em `.env`):

```
ADMIN_LOGIN=admin
ADMIN_PASSWORD=ChangeMe!123
```

- Opcionalmente, 3 usuários de teste (um por perfil não-admin) somente quando
  `SEED_TEST_USERS=true` no `.env`. Todos forçam troca de senha no primeiro
  acesso. Senha padrão = últimos 4 dígitos do CPF.

  | Login | Nome | Perfil |
  |-------------|------|--------|
  | 20030040175 | Maria Suporte | suporte |
  | 20030040256 | João Governador | governador |
  | 20030040337 | Ana Solicitante | gestor_solicitante |

> ⚠️ Troque a senha do admin e gere `JWT_SECRET_KEY`/`MINIO_ROOT_PASSWORD`
> novos antes de qualquer deploy em produção. O backend recusa subir com
> `APP_ENV=production` se algum desses ainda estiver no valor default.

## Domínio

### Perfis (RBAC) + flags

Existem **4 perfis** + 3 flags privilegiadas controladas pelo administrador.

| Perfil | Permissões base |
|--------|-----------------|
| `gestor_solicitante` | Abre as próprias solicitações; vê só as suas; status sempre mascarado como "Cadastrada" (a menos que o admin libere via flag) |
| `suporte` | Vê todas as solicitações, muda status, comenta, anexa, exporta CSV, gerencia usuários (abaixo de si) |
| `governador` | Read-only sobre tudo. Pode gerenciar usuários só com flag; pode abrir solicitações só com flag |
| `administrador` | CRUD total; gerencia flags; vê CPF completo; root é intocável por outros |

Flags (atribuídas pelo admin a usuários individuais):

- `pode_criar_usuarios` — libera o módulo de usuários para o `governador`
- `pode_criar_solicitacoes` — libera abertura de solicitação para `suporte` e `governador`
- `ver_status_solicitacao` — libera o `gestor_solicitante` a ver o status real

### Áreas de solicitação (8)

Gestão e Economia · Desenvolvimento Sustentável · Saúde · Bem-estar ·
Educação · Segurança · Infraestrutura · Ciência, Tecnologia e Inovação.

### Municípios de Roraima (15 + Outros)

Alto Alegre, Amajari, Boa Vista, Bonfim, Cantá, Caracaraí, Caroebe, Iracema,
Mucajaí, Normandia, Pacaraima, Rorainópolis, São João da Baliza, São Luiz,
Uiramutã + **Outros** (com campo livre para comunidade/vila/vicinal).

### Status de solicitação (máquina de estados)

```
cadastrada → em_analise → atendida
                       ↘ indeferida
                       ↘ cancelada
cadastrada → cancelada
```

`atendida`, `indeferida` e `cancelada` são **terminais** (não voltam).

## Endpoints (REST, prefixo `/api/v1`)

```
POST   /auth/login              # login + senha → access + refresh
POST   /auth/refresh            # rotaciona refresh token
POST   /auth/logout             # revoga refresh atual
GET    /auth/me                 # dados do usuário autenticado
PATCH  /auth/me                 # edita os próprios dados
PATCH  /auth/me/senha           # troca a própria senha

GET    /municipios              # 15 RR + "Outros"

GET    /pessoas                 # paginado, busca, filtro por município
POST   /pessoas                 # admin
GET    /pessoas/{id}
PUT    /pessoas/{id}            # admin (CPF imutável)
DELETE /pessoas/{id}            # admin (soft delete)

GET    /solicitacoes            # paginado, filtros
POST   /solicitacoes
GET    /solicitacoes/export     # CSV (suporte/admin)
GET    /solicitacoes/{id}
PUT    /solicitacoes/{id}       # dono edita enquanto cadastrada
PATCH  /solicitacoes/{id}/status
POST   /solicitacoes/{id}/comentarios   # anotação interna (suporte/admin)
GET    /solicitacoes/{id}/eventos       # timeline

GET    /solicitacoes/{id}/anexos
POST   /solicitacoes/{id}/anexos        # upload (PDF/imagem/.docx/.xlsx, máx. 10 MB)
GET    /solicitacoes/{id}/anexos/{aid}/download
DELETE /solicitacoes/{id}/anexos/{aid}

GET    /usuarios                # módulo gerenciado por suporte/admin
POST   /usuarios
GET    /usuarios/{id}
PUT    /usuarios/{id}
PATCH  /usuarios/{id}/senha     # reset administrativo (força troca no próximo login)
DELETE /usuarios/{id}           # soft delete + revoga sessões

GET    /auditoria               # log de eventos (admin)

GET    /health                  # liveness/readiness
```

Todas as respostas seguem o envelope:

```json
{ "data": ..., "meta": { "page": 1, "page_size": 20, "total": 42 } }
```

Erros:

```json
{ "error": { "code": "CPF_DUPLICADO", "message": "...", "details": { ... } } }
```

## Comandos úteis

```bash
# Logs
docker compose logs -f backend

# Rodar migrations manualmente
docker compose exec backend alembic upgrade head

# Criar nova migration
docker compose exec backend alembic revision --autogenerate -m "msg"

# Re-rodar o seed (idempotente)
docker compose exec backend python -m app.db.seed

# Inspecionar banco
docker compose exec db psql -U demandas_app -d demandasrr -c "\dt"
```

## Estrutura

```
demandasrr/
├── backend/
│   ├── app/
│   │   ├── api/v1/             # routers HTTP (controllers)
│   │   ├── core/               # config, security (JWT+bcrypt), errors, logging, rate-limit
│   │   ├── db/                 # session async, seed, base
│   │   ├── models/             # SQLAlchemy
│   │   ├── repositories/       # acesso a dados
│   │   ├── schemas/            # Pydantic v2 DTOs
│   │   └── services/           # regras de negócio + auditoria
│   └── alembic/                # migrations versionadas
├── frontend/                   # React 18 + Vite + TS + Tailwind + TanStack Query + Zustand + HeadlessUI 2 + PWA
│   └── src/
│       ├── app/                # bootstrap, router, guards
│       ├── shared/             # api client, components, layouts, hooks, utils
│       └── features/           # vertical slices (auth, solicitacoes, usuarios, ...)
├── db/init/                    # hardening do Postgres (cria usuário NOSUPERUSER)
├── nginx/nginx.conf            # reverse proxy + WAF leve + security headers + CSP
├── docker-compose.yml          # db + minio + backend + frontend + nginx
└── README.md
```

## Segurança (resumo)

- **Senhas:** bcrypt cost 12, mínimo 6 chars + letras + números, troca forçada no primeiro acesso
- **JWT:** access curto (15 min) + refresh rotacionável (7 d, persistido com `jti` em tabela `refresh_token`)
- **Rate limit:** `5/minute` no `/auth/login` via slowapi (com `X-Forwarded-For`)
- **IP lockout:** bloqueia o IP após 10 falhas em 15 min (auditoria persistida em `audit_log`)
- **RBAC:** dependência reutilizável `require_role(...)` + flags individuais para liberar capacidades pontuais
- **Auditoria:** todas as ações sensíveis (login, criação/edição/inativação de usuário, mudança de status, upload, comentário, reset de senha) gravadas em `audit_log` com snapshot do ator
- **CPF:** validação dos dígitos verificadores + UNIQUE + mascaramento (`***.***.***-XX`) para perfis não-admin
- **CORS:** lista branca explícita via `BACKEND_CORS_ORIGINS` (obrigatória em `APP_ENV=production`)
- **CSP + headers de segurança** no Nginx (X-Frame, X-Content-Type, Referrer-Policy, Permissions-Policy, CSP estrita)
- **WAF leve no Nginx:** bloqueia user-agents de scanners (sqlmap/nikto/nuclei/...) e probe paths (`/wp-admin`, `/.env`, `/.git`, `phpmyadmin`, ...) na borda com 444
- **Postgres hardening:** app conecta como `demandas_app` (NOSUPERUSER, sem `COPY FROM PROGRAM`, sem acesso a arquivos do servidor; linguagens não confiáveis removidas)
- **Uploads:** validação de extensão + MIME + magic bytes; lista branca de tipos; teto de tamanho e quantidade
- **Tokens no frontend:** access em memória (Zustand); refresh em `localStorage` com rotação no servidor
- **Defaults proibidos em produção:** `JWT_SECRET_KEY`, `ADMIN_PASSWORD` e `MINIO_ROOT_PASSWORD` no valor de fábrica impedem o boot quando `APP_ENV=production`

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as variáveis abaixo. Para gerar
um `JWT_SECRET_KEY` forte:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

| Variável | Descrição |
|----------|-----------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Bootstrap do Postgres (superuser interno) |
| `POSTGRES_HOST` / `POSTGRES_PORT` | Padrão `db` / `5432` no compose |
| `APP_DB_USER` / `APP_DB_PASSWORD` | Usuário NOSUPERUSER que a aplicação usa |
| `JWT_SECRET_KEY` | Chave de assinatura JWT (mín. 32 chars, validado no boot) |
| `JWT_ALGORITHM` | Default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Validade do access token (default 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Validade do refresh token (default 7) |
| `REFRESH_COOKIE_NAME` / `REFRESH_COOKIE_SAMESITE` / `REFRESH_COOKIE_DOMAIN` | Cookie HttpOnly do refresh token |
| `APP_ENV` | `development` ou `production` (production exige segredos não-default) |
| `LOG_LEVEL` | `INFO` (default) |
| `BACKEND_CORS_ORIGINS` | Lista branca de origens (CSV) — obrigatória em produção |
| `LOGIN_RATE_LIMIT` | Ex.: `5/minute` |
| `ADMIN_NOME` / `ADMIN_LOGIN` / `ADMIN_PASSWORD` | Seed do admin inicial |
| `SEED_TEST_USERS` | Se `true`, cria 3 usuários de teste além do admin (default `false`) |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Credenciais do MinIO (storage S3-compatível) |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_REGION` | Endpoint, bucket e região do storage |
| `MAX_UPLOAD_MB` / `MAX_ANEXOS_POR_SOLICITACAO` | Limites de anexo (default 10 MB / 20 anexos) |
| `VITE_API_BASE_URL` | URL pública da API (default `/api/v1`) |
| `VITE_APP_NAME` | Nome exibido no PWA |

> ⚠️ O `.env` real **não** entra no repositório (já está no `.gitignore`).
> Para produção, gere segredos novos e nunca reutilize os defaults.

## Fluxo do usuário

1. `docker compose up -d --build` → migrações + seed (municípios + admin + usuários de teste)
2. Acessar http://localhost → tela de login centralizada
3. Login com `admin / ChangeMe!123` → dashboard
4. **Admin** cadastra pessoas, usuários, atribui flags e gerencia solicitações
5. **Gestor solicitante** abre solicitações vinculadas a si (status sempre "Cadastrada")
6. **Suporte** opera a fila: muda status, anexa, comenta internamente, exporta CSV
7. **Governador** acompanha tudo em modo read-only
8. PWA instalável no mobile (manifest + service worker)

## Deploy em VM (resumo)

1. Provisionar a VM com Docker e Docker Compose v2
2. Apontar o subdomínio (ex.: `demandasrr.sistemasme.com`) para o IP da VM (registro A)
3. `git clone` na VM
4. Criar `.env` na raiz (ver "Variáveis de ambiente") e preencher:
   - `APP_ENV=production`
   - Segredos novos: `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `MINIO_ROOT_PASSWORD`, `ADMIN_PASSWORD`
   - `BACKEND_CORS_ORIGINS=https://demandasrr.sistemasme.com`
5. `docker compose up -d --build`
6. Configurar o reverse proxy / HTTPS (Let's Encrypt) à frente do container do Nginx
7. Habilitar HSTS no `nginx/nginx.conf` (linha já comentada) assim que o HTTPS estiver ativo

Guia completo: [README_DEPLOY_VM.md](README_DEPLOY_VM.md)

## Roadmap

Ver [ROADMAP.md](ROADMAP.md).

## Documentação da API

Swagger automático em http://localhost/api/docs (FastAPI gera o OpenAPI).
