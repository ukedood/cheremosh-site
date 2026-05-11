#!/usr/bin/env bash
set -euo pipefail

SECRETS_DIR="$HOME/Dev/_ORCH/secrets"
VERCEL_TOKEN=""

if [ -f "$SECRETS_DIR/vercel.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$SECRETS_DIR/vercel.env"; set +a
  VERCEL_TOKEN="${VERCEL_TOKEN:-}"
elif [ -f "$SECRETS_DIR/.env" ]; then
  set -a; source "$SECRETS_DIR/.env"; set +a
  VERCEL_TOKEN="${VERCEL_TOKEN:-}"
elif [ -f "$SECRETS_DIR/vercel_token" ]; then
  VERCEL_TOKEN="$(cat "$SECRETS_DIR/vercel_token")"
elif [ -f "$SECRETS_DIR/vercel.key" ]; then
  VERCEL_TOKEN="$(cat "$SECRETS_DIR/vercel.key")"
fi

if [ -z "$VERCEL_TOKEN" ]; then
  echo "ERROR: No Vercel token found. Tried:"
  echo "  $SECRETS_DIR/vercel.env"
  echo "  $SECRETS_DIR/.env"
  echo "  $SECRETS_DIR/vercel_token"
  echo "  $SECRETS_DIR/vercel.key"
  exit 1
fi

echo "Vercel token loaded."

if ! command -v vercel &>/dev/null; then
  echo "Installing Vercel CLI..."
  npm i -g vercel@latest
fi

echo "Deploying to Vercel production..."
OUTPUT=$(vercel --prod --yes --token "$VERCEL_TOKEN" --scope ukeclaude-2284s-projects 2>&1)
echo "$OUTPUT"

PROD_URL=$(echo "$OUTPUT" | grep -oE 'https://[a-zA-Z0-9._-]+\.vercel\.app' | tail -1)

if [ -n "$PROD_URL" ]; then
  echo ""
  echo "=== Deploy complete ==="
  echo "Production URL: $PROD_URL"
else
  echo "Deploy may have completed — check output above for the URL."
fi
