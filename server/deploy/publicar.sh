#!/usr/bin/env bash
#
# Publica en el servidor la última versión que haya en GitHub.
#
#   ./deploy/publicar.sh ubuntu@51.79.66.133
#
# No sube ficheros: le dice al servidor que se traiga los cambios él mismo, los
# compile y reinicie el servicio. Así lo que corre en producción es exactamente
# lo que hay en la rama, sin sorpresas por ficheros sueltos.

set -euo pipefail

DESTINO="${1:-}"
RUTA_REMOTA="${RUTA_REMOTA:-/opt/pesschess}"
PUERTO="${PUERTO:-3100}"

if [[ -z "$DESTINO" ]]; then
  echo "Uso: $0 usuario@servidor" >&2
  exit 1
fi

echo "▸ Comprobando que no queda nada sin subir…"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "  Hay cambios sin confirmar. Haz commit y push antes de publicar." >&2
  git status --short >&2
  exit 1
fi
git fetch --quiet origin
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse @{u})" ]]; then
  echo "  Tu rama no coincide con GitHub. Haz push antes de publicar." >&2
  exit 1
fi

echo "▸ Actualizando el servidor…"
ssh "$DESTINO" bash -s <<REMOTO
set -euo pipefail
cd "$RUTA_REMOTA"

git fetch --quiet origin
git reset --hard origin/main
echo "  versión: \$(git log --oneline -1)"

cd server
npm ci --silent
npm run build

# Las herramientas de compilación ya no hacen falta en producción.
npm prune --omit=dev --silent

sudo systemctl restart pesschess
REMOTO

echo "▸ Comprobando que responde…"
sleep 2
ssh "$DESTINO" "curl -fsS http://localhost:$PUERTO/health" && echo

echo "✓ Publicado."
