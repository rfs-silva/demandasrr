#!/bin/bash
# Hardening do PostgreSQL — executa UMA vez, no bootstrap do volume.
#
# Fecha o vetor de RCE via banco que é classicamente explorado após SQL
# injection:
#   COPY ... FROM PROGRAM '...';         -- exige superuser ou pg_execute_server_program
#   CREATE FUNCTION ... LANGUAGE C ...;  -- exige superuser
#   CREATE EXTENSION plperlu/plpython3u; -- "untrusted" PLs, code exec
#
# Estratégia:
#   - O usuário bootstrap (POSTGRES_USER) é superuser e fica isolado dentro
#     do container (nada externo conecta com ele).
#   - Criamos um usuário NOSUPERUSER para o app (APP_DB_USER) com privilégios
#     mínimos para rodar migrações e DML em public.
#   - O DATABASE_URL do backend aponta para APP_DB_USER.

set -e

if [ -z "$APP_DB_USER" ] || [ -z "$APP_DB_PASSWORD" ]; then
    echo "[db-init] APP_DB_USER/APP_DB_PASSWORD ausentes — skip hardening."
    exit 0
fi

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" <<-EOSQL
    -- Cria o role do app se não existir. Idempotente.
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$APP_DB_USER') THEN
            CREATE ROLE "$APP_DB_USER"
                LOGIN
                PASSWORD '$APP_DB_PASSWORD'
                NOSUPERUSER
                NOCREATEROLE
                NOCREATEDB
                NOREPLICATION
                NOBYPASSRLS
                INHERIT;
        END IF;
    END
    \$\$;

    -- "Untrusted" procedural languages: NUNCA devem existir aqui.
    DROP EXTENSION IF EXISTS plperlu;
    DROP EXTENSION IF EXISTS plpython3u;
    DROP EXTENSION IF EXISTS pllua;

    -- PUBLIC sem nada implícito (defesa em profundidade).
    REVOKE ALL ON DATABASE "$POSTGRES_DB" FROM PUBLIC;
    REVOKE ALL ON SCHEMA   public          FROM PUBLIC;

    -- Privilégios mínimos para o app rodar alembic + DML em public.
    GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$APP_DB_USER";
    GRANT USAGE, CREATE ON SCHEMA public      TO "$APP_DB_USER";

    -- Garante que o app NÃO é membro de papéis perigosos.
    -- (Por padrão não é. Belt and suspenders.)
    DO \$\$
    BEGIN
        BEGIN
            EXECUTE format(
                'REVOKE pg_execute_server_program FROM %I', '$APP_DB_USER'
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            EXECUTE format('REVOKE pg_read_server_files FROM %I', '$APP_DB_USER');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            EXECUTE format('REVOKE pg_write_server_files FROM %I', '$APP_DB_USER');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END
    \$\$;
EOSQL

echo "[db-init] $APP_DB_USER criado como NOSUPERUSER em $POSTGRES_DB"
