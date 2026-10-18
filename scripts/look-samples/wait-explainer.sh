#!/usr/bin/env bash
# Poll one explainer job with the app's render credentials (never printed), then download its outputs.
# bash scripts/look-samples/wait-explainer.sh <job id> <out dir>
set -euo pipefail
eval "$(grep -E '^RENDER_(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|BUCKET|AWS_REGION)=' '/c/dev/1 - OneDollarDecks/.env.local' | sed 's/^/export /')"
export AWS_ACCESS_KEY_ID="$RENDER_AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$RENDER_AWS_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION="${RENDER_AWS_REGION:-us-east-1}"
unset AWS_SESSION_TOKEN AWS_PROFILE
ID="$1"; OUT="$2"; mkdir -p "$OUT"
for i in $(seq 1 120); do
  S=$(aws s3 cp "s3://$RENDER_BUCKET/jobs/$ID/status.json" - 2>/dev/null || echo '{}')
  echo "$(date +%T) $S" | head -c 300; echo
  case "$S" in
    *'"state":"done"'*)
      for k in $(echo "$S" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{for(const k of JSON.parse(d).outputs||[])console.log(k)})'); do
        aws s3 cp "s3://$RENDER_BUCKET/jobs/$ID/$k" "$OUT/${k#out/}" --only-show-errors
      done
      echo "DONE"; exit 0 ;;
    *'"state":"failed"'*) echo "FAILED"; exit 1 ;;
  esac
  sleep 20
done
echo "TIMEOUT"; exit 2
