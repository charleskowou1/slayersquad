#!/bin/bash
# One-time setup for the notification service. Run from the squad-draft folder: bash worker/setup.sh
# Your browser opens once to sign in to Cloudflare. The private key goes straight to Cloudflare and is never saved or printed.
set -e
cd "$(dirname "$0")"
W="npx --yes wrangler@3"
$W login
OUT=$($W kv namespace create PUSH 2>&1); echo "$OUT" | tail -3
ID=$(echo "$OUT" | grep -oE '[0-9a-f]{32}' | head -1); [ -n "$ID" ] || { echo "Could not read the KV id"; exit 1; }
sed -i '' "s/KV_ID_HERE/$ID/" wrangler.toml
KEYS=$(node -e "const {generateKeyPairSync:g}=require('crypto');const k=g('ec',{namedCurve:'P-256'}).privateKey.export({format:'jwk'});const u=s=>Buffer.from(s,'base64url');console.log(k.d+' '+Buffer.concat([Buffer.from([4]),u(k.x),u(k.y)]).toString('base64url'))")
PRIV=${KEYS% *}; PUB=${KEYS#* }
$W deploy 2>&1 | tee /tmp/ss-push.txt | tail -4
printf %s "$PUB" | $W secret put VAPID_PUBLIC
printf %s "$PRIV" | $W secret put VAPID_PRIVATE
unset PRIV KEYS
echo; echo "=== SEND THESE TWO LINES TO CLAUDE ==="
grep -oE 'https://[a-z0-9.-]+workers\.dev' /tmp/ss-push.txt | head -1
echo "$PUB"
