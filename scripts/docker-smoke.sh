#!/usr/bin/env bash
set -euo pipefail

base_url=${LEAKGUARD_BASE_URL:-http://localhost:3000}
admin_token=${LEAKGUARD_ADMIN_TOKEN:-local-admin}

health=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/healthz")
if [ "$health" != "200" ]; then
  echo "healthz failed: $health"
  exit 1
fi

project_json=$(curl -s -X POST "$base_url/v1/projects" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"repoId":"smoke-repo","name":"Smoke Repo"}')

ingestion_token=$(echo "$project_json" | sed -n 's/.*"ingestionToken":"\([^"]*\)".*/\1/p')
if [ -z "$ingestion_token" ]; then
  echo "failed to mint ingestion token"
  echo "$project_json"
  exit 1
fi

payload='{"repoId":"smoke-repo","userId":"smoke-user","findings":[{"type":"github_pat","file":"src/app.ts","line":1,"previewMasked":"[REDACTED]","fingerprint":"fp_smoke"}]}'

post_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$base_url/v1/findings" \
  -H "Authorization: Bearer $ingestion_token" \
  -H "Content-Type: application/json" \
  -d "$payload")
if [ "$post_status" != "200" ]; then
  echo "POST /v1/findings failed: $post_status"
  exit 1
fi

findings=$(curl -s "$base_url/v1/projects/org_default_smoke-repo/findings")
if ! echo "$findings" | grep -q '"status"'; then
  echo "GET findings failed"
  echo "$findings"
  exit 1
fi

id=$(echo "$findings" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -z "$id" ]; then
  echo "could not find finding id"
  echo "$findings"
  exit 1
fi

status_update=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$base_url/v1/findings/$id/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"fixed"}')
if [ "$status_update" != "200" ]; then
  echo "status update failed: $status_update"
  exit 1
fi

echo "docker smoke ok"
