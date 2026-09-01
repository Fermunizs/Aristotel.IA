#!/bin/bash
# Dump diário do Postgres da AristotelIA. Roda NA VM via systemd timer
# (aristotelia-backup.timer). Instalação: ver scripts/systemd/README.
set -euo pipefail

DIR="${HOME}/backups"
KEEP=14
ENV_FILE="${HOME}/aristotelia/.env"

mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$DIR/aristotelia-$STAMP.sql.gz"

# dump direto do container (o binário pg_dump vive lá, não no host)
docker exec arist-pg pg_dump -U arist -d aristotelia --no-owner --clean --if-exists \
  | gzip > "$FILE"

# sanidade: dump vazio = falhou
if [ ! -s "$FILE" ] || [ "$(gzip -dc "$FILE" | head -c 200 | wc -c)" -lt 50 ]; then
  echo "ERRO: dump vazio/inválido — $FILE" >&2
  rm -f "$FILE"
  exit 1
fi

# retenção local
ls -1t "$DIR"/aristotelia-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f

# cópia off-site (opcional): PUT numa URL pré-assinada
#   OCI Pre-Authenticated Request (bucket, "Permitir gravações", sem expiração) — cola em BACKUP_UPLOAD_URL no .env
#   ou qualquer presigned URL de S3/GCS.
if [ -f "$ENV_FILE" ]; then
  URL=$(grep -E '^BACKUP_UPLOAD_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"' " || true)
  if [ -n "${URL:-}" ]; then
    if curl -fsS -X PUT --upload-file "$FILE" "${URL%/}/$(basename "$FILE")"; then
      echo "off-site: OK"
    else
      echo "off-site: FALHOU (dump local preservado)" >&2
    fi
  fi
fi

echo "backup OK: $FILE ($(du -h "$FILE" | cut -f1)) — $(ls -1 "$DIR"/aristotelia-*.sql.gz | wc -l) dumps locais"
