# Unidades systemd na VM Oracle

Instaladas em `/etc/systemd/system/`. Ficam versionadas aqui como fonte da verdade.

| unidade | o que faz |
|---|---|
| `aristotelia.service` | o bot (`python -m bot.main`) |
| `aristotelia-web.service` | o painel Next (`node server.js`) |
| `aristotelia-backup.{service,timer}` | `pg_dump` diário às 03:30 → `~/backups/` (mantém 14) + PUT off-site se `BACKUP_UPLOAD_URL` no `.env` |
| `arist-tunnel.service` / `arist-url-sync.timer` | cloudflared quick tunnel + sync da URL pro `WEB_URL` |

## Instalar / atualizar o backup

```bash
scp -i ~/.ssh/aristotelia_oracle scripts/systemd/aristotelia-backup.* ubuntu@147.15.46.51:/tmp/
ssh -i ~/.ssh/aristotelia_oracle ubuntu@147.15.46.51 '
  sudo cp /tmp/aristotelia-backup.service /tmp/aristotelia-backup.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now aristotelia-backup.timer
  systemctl start aristotelia-backup.service   # roda um agora
  systemctl status aristotelia-backup.service --no-pager
'
```

## Cópia off-site (recomendado)

O dump local já protege contra o volume do Docker sumir. Pra proteger contra a VM/disco morrer, adicione uma URL de upload pré-assinada em `~/aristotelia/.env`:

```
BACKUP_UPLOAD_URL=https://<namespace>.objectstorage.sa-saopaulo-1.oci.customer-oci.com/p/<token>/n/<ns>/b/<bucket>/o/
```

Como gerar (Oracle Cloud, sem CLI, ~3 min, custo US$0 — Object Storage tem 20 GB Always Free):

1. Console OCI → **Storage → Buckets** → *Create Bucket* (nome: `aristotelia-backups`).
2. Abra o bucket → **Pre-Authenticated Requests** → *Create*.
3. Tipo: **Bucket** · Acesso: **Permitir gravações de objetos** (write-only) · Expiração: coloque bem longe (ex.: 3 anos).
4. Copie a URL gerada, cole em `BACKUP_UPLOAD_URL=` no `.env`, `sudo systemctl restart aristotelia` não é necessário (o script lê o `.env` a cada execução).
5. Teste: `systemctl start aristotelia-backup.service && journalctl -u aristotelia-backup -o cat --no-pager | tail`.
