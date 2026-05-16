# Deploy em VM

Guia mínimo para subir a aplicação em outra VM com previsibilidade, HTTPS e os ajustes obrigatórios.

## Cenário esperado

- VM Linux Ubuntu 22.04 ou 24.04
- Domínio ou subdomínio apontando para a VM
- Docker + Docker Compose v2 instalados
- A aplicação continuará exposta internamente em `127.0.0.1:8080` pelo container `demandasrr-nginx`
- O HTTPS público ficará no Nginx do host da VM, fazendo proxy para `127.0.0.1:8080`

## 1. DNS

Crie um registro `A` apontando o domínio para o IP público da VM.

Exemplo:

- `demandas.exemplo.gov.br` -> `203.0.113.10`

Confirme antes de prosseguir:

```bash
dig +short demandas.exemplo.gov.br
```

## 2. Preparar a VM

Atualize o sistema e instale o que será usado no deploy:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx
```

Instale Docker Engine + Compose Plugin se ainda não estiverem presentes:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Valide:

```bash
docker --version
docker compose version
```

## 3. Clonar o projeto

```bash
cd /opt
sudo git clone https://github.com/rfs-silva/demandas-rr.git
sudo chown -R $USER:$USER /opt/demandas-rr
cd /opt/demandas-rr
```

## 4. Criar o `.env`

Crie o arquivo `.env` na raiz do projeto. Esse é o ponto principal de ajuste do deploy.

```bash
cat > /opt/demandas-rr/.env <<'EOF'
APP_NAME=Demandas RR
APP_ENV=production
LOG_LEVEL=INFO

POSTGRES_USER=demandas_root
POSTGRES_PASSWORD=TROQUE_POR_UMA_SENHA_FORTE
POSTGRES_DB=demandasrr
POSTGRES_HOST=db
POSTGRES_PORT=5432

APP_DB_USER=demandas_app
APP_DB_PASSWORD=TROQUE_POR_UMA_SENHA_FORTE_DIFERENTE

JWT_SECRET_KEY=GERAR_UMA_CHAVE_COM_48+_CARACTERES
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_COOKIE_NAME=demandasrr_refresh
REFRESH_COOKIE_SAMESITE=lax
REFRESH_COOKIE_DOMAIN=

BACKEND_CORS_ORIGINS=https://demandas.exemplo.gov.br
LOGIN_RATE_LIMIT=5/minute
LOGIN_LOCKOUT_THRESHOLD=10
LOGIN_LOCKOUT_WINDOW_MIN=15

ADMIN_NOME=Administrador
ADMIN_LOGIN=admin
ADMIN_PASSWORD=TROQUE_POR_UMA_SENHA_FORTE
SEED_TEST_USERS=false

STORAGE_ENDPOINT=http://minio:9000
STORAGE_BUCKET=solicitacoes-anexos
STORAGE_REGION=us-east-1
MINIO_ROOT_USER=demandas_minio
MINIO_ROOT_PASSWORD=TROQUE_POR_UMA_SENHA_FORTE

MAX_UPLOAD_MB=10
MAX_ANEXOS_POR_SOLICITACAO=20

VITE_API_BASE_URL=/api/v1
VITE_APP_NAME=Demandas RR
EOF
```

Gere uma chave JWT forte:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Onde ajustar:

- `.env`: domínio público, senhas, segredo JWT e credenciais do admin inicial
- `BACKEND_CORS_ORIGINS`: use a URL pública final, com `https://`
- `REFRESH_COOKIE_DOMAIN`: deixe vazio se a aplicação rodar no mesmo host do navegador; só preencha se houver necessidade real de compartilhar cookie entre subdomínios

## 5. Subir os containers

```bash
cd /opt/demandas-rr
docker compose up -d --build
docker compose ps
```

Verificações mínimas:

```bash
curl -sf http://127.0.0.1:8080/api/v1/health
docker compose logs --no-color backend | tail -100
docker compose logs --no-color nginx | tail -100
```

O health local deve responder algo como:

```json
{"status":"ok","db":"ok"}
```

## 6. Publicar com Nginx no host

Crie um site no Nginx do host apontando para o proxy interno em `127.0.0.1:8080`.

```bash
sudo tee /etc/nginx/sites-available/demandas-rr >/dev/null <<'EOF'
server {
    listen 80;
    server_name demandas.exemplo.gov.br;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/demandas-rr /etc/nginx/sites-enabled/demandas-rr
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Emitir HTTPS com Let's Encrypt

```bash
sudo certbot --nginx -d demandas.exemplo.gov.br
```

Depois valide:

```bash
curl -I https://demandas.exemplo.gov.br
curl -sf https://demandas.exemplo.gov.br/api/v1/health
```

## 8. HSTS e ajuste final

Depois que o HTTPS estiver funcionando e estável, habilite HSTS no arquivo [nginx/nginx.conf](nginx/nginx.conf) descomentando a linha:

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
```

Depois aplique:

```bash
cd /opt/demandas-rr
docker compose up -d nginx
```

## 9. Portas e firewall

Abra apenas o necessário no host:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Não exponha `5432`, `9000` ou `9001` publicamente.

## 10. Comandos de operação

Subir e atualizar:

```bash
cd /opt/demandas-rr
git pull
docker compose up -d --build
```

Atualizar sem perder dados do Postgres e do MinIO:

```bash
cd /opt/demandas-rr
docker compose --env-file nginx/.env stop
docker compose --env-file nginx/.env up -d --build
```

Se precisar recriar os containers, mantenha os volumes:

```bash
cd /opt/demandas-rr
docker compose --env-file nginx/.env down
docker compose --env-file nginx/.env up -d --build
```

Esses fluxos preservam os volumes nomeados `postgres_data` e `minio_data` definidos no Compose.

Nunca use para deploy rotineiro:

```bash
docker compose down -v
docker volume rm postgres_data minio_data
docker system prune --volumes
```

Ver status:

```bash
cd /opt/demandas-rr
docker compose ps
```

Ver logs:

```bash
cd /opt/demandas-rr
docker compose logs -f backend
docker compose logs -f nginx
```

Executar migrações manualmente, se necessário:

```bash
cd /opt/demandas-rr
docker compose exec backend alembic upgrade head
```

## 11. Checklist de sucesso

- DNS resolve para a VM
- `docker compose ps` mostra `healthy` para `db`, `backend` e `nginx`
- `curl -sf http://127.0.0.1:8080/api/v1/health` funciona dentro da VM
- `curl -sf https://SEU_DOMINIO/api/v1/health` funciona externamente
- login do admin funciona
- refresh de sessão funciona sem `localStorage`, via cookie `HttpOnly`

## 12. Onde mexer se algo mudar

- [docker-compose.yml](docker-compose.yml): portas, serviços e volumes
- [nginx/nginx.conf](nginx/nginx.conf): headers, HSTS e regras da borda do container
- `.env` na raiz da VM: segredos, domínio, CORS e parâmetros de autenticação
- `/etc/nginx/sites-available/demandas-rr` no host: domínio público e proxy reverso