# db/ — schema do AristotelIA (Fase 1+)

Postgres é a fonte de estado do produto multiusuário (substitui os `data/*.json` da Fase 0).

## Migrations

`db/migrations/NNNN_nome.sql` — SQL puro, numeradas, aplicadas em ordem.
São a **fonte da verdade** do schema. O bot Python aplica as pendentes no startup (`bot/db.py`).
O web (Next.js/Drizzle) mapeia os tipos por cima — **não** roda drizzle-kit migrate contra este banco.

## Onde roda

VM Oracle (`147.15.46.51`), container Docker `arist-pg` (postgres:16-alpine):
- porta `127.0.0.1:5432` (só local — bot e web rodam na mesma VM)
- volume `arist_pgdata`, `--restart unless-stopped`
- db `aristotelia`, user `arist`

Acesso: `sudo docker exec -it arist-pg psql -U arist -d aristotelia`

## Conexão (apps)

`DATABASE_URL=postgresql://arist:arist_local_dev@127.0.0.1:5432/aristotelia`
(no `.env` do bot e no `.env.local` do web)

## Dev local

`docker run -d --name arist-pg -e POSTGRES_USER=arist -e POSTGRES_PASSWORD=arist_local_dev -e POSTGRES_DB=aristotelia -p 5432:5432 postgres:16-alpine`
