#!/bin/bash
# Deploy do painel web na VM Oracle.
# Build local num diretório fora do OneDrive (o OneDrive corrompe o .next do Next).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/web"
BUILD="${TMPDIR:-/tmp}/arist-web-build"
VM="ubuntu@147.15.46.51"
KEY="$HOME/.ssh/aristotelia_oracle"

# primeira vez: copia tudo (com node_modules). depois: só o que muda.
if [ ! -d "$BUILD/node_modules" ]; then
  echo "→ cópia inicial (com node_modules)…"
  rm -rf "$BUILD" && mkdir -p "$BUILD"
  cp -r "$SRC"/{src,public,package.json,package-lock.json,next.config.ts,tsconfig.json,postcss.config.mjs,next-env.d.ts,node_modules} "$BUILD/"
else
  rm -rf "$BUILD/src" && cp -r "$SRC/src" "$BUILD/src"
  cp "$SRC/next.config.ts" "$SRC/package.json" "$BUILD/"
fi

cd "$BUILD"
rm -rf .next

# gate de tipos — o next build roda com ignoreBuildErrors (worker segfauta no
# Node 24/Win), então a checagem de verdade é aqui e ABORTA o deploy se falhar.
echo "→ checagem de tipos (tsc --noEmit)…"
npx tsc --noEmit

DATABASE_URL="postgresql://x:x@127.0.0.1/x" npx next build

rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

tar czf /tmp/arist-web.tgz -C .next/standalone .
cat /tmp/arist-web.tgz | ssh -i "$KEY" "$VM" '
  sudo systemctl stop aristotelia-web
  cp ~/aristotelia-web/web.env /tmp/web.env
  rm -rf ~/aristotelia-web && mkdir ~/aristotelia-web
  tar xzf - -C ~/aristotelia-web
  cp /tmp/web.env ~/aristotelia-web/web.env
  sudo systemctl start aristotelia-web
  sleep 3 && systemctl is-active aristotelia-web
'
echo "✓ painel deployado"
