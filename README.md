# LeakGuard

Local-first secret leak prevention: VSCode extension + Fastify API + minimal dashboard.

## Quickstart (5-minute path)
```
# 1) start server with Docker
# from repo root
 docker compose up --build -d
 docker compose run --rm migrate

# 2) mint ingestion token
 cd server
 npm install
 npm run leakguard -- token mint --project quickstart-repo

# 3) connect VSCode
# in VSCode: run "LeakGuard: Connect" and enter:
#   apiUrl = http://localhost:3000
#   token = <printed token>

# 4) add a sample secret (fake)
# create a file and add:
#   const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd";

# 5) verify
# diagnostics highlight Å® Summary view shows finding Å® Quick Fix replaces/ignores Å®
# open dashboard http://localhost:3000 Å® set status Å® Slack (optional)
```

## CI Proof (canonical)
CI generates the proof artifact in GitHub Actions. No local Docker/GitHub auth required.

What you get:
- Run URL (in job summary)
- Badge URL (in job summary)
- Artifact: `beta-proof` containing `beta-proof.txt` + logs

## Requirements
- Node.js 22 LTS
- npm 9+
- Docker (recommended on Windows ARM64)

## Monorepo scripts (root)
```
npm install
npm run lint
npm run test
npm run build
```

## Server (Prisma binary, local)
```
cd server
cp .env.example .env
npm install
npm run clean:prisma:windows
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

Dashboard: http://localhost:3000

### Token mint CLI
Mint an ingestion token (printed once):
```
cd server
npm run leakguard -- token mint --project <repoId>
```

### Ingestion auth
Create a project and token (admin-only):
```
# set LEAKGUARD_ADMIN_TOKEN in .env
curl -X POST http://localhost:3000/v1/projects \
  -H "Authorization: Bearer $LEAKGUARD_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repoId":"my-repo","name":"My Repo"}'
```
Response includes `ingestionToken` (store it once in VSCode via LeakGuard: Connect).

### API
- GET  /healthz
- GET  /v1/auth/verify
- POST /v1/projects (admin-only; returns ingestionToken)
- POST /v1/findings (requires Authorization: Bearer <ingestionToken>)
- GET  /v1/projects
- GET  /v1/projects/:id/findings?since=&type=&status=
- POST /v1/findings/:id/status
- POST /v1/webhooks/slack/test

### Slack (Team)
Set `SLACK_WEBHOOK_URL` in the server environment to receive batched notifications for new findings.

### CORS
- Dev: permissive if `CORS_ORIGIN` is unset.
- Prod: set `CORS_ORIGIN` to a comma-separated allowlist (required for cross-origin access).

## Docker verification (canonical fallback)
```
# from repo root
 docker compose up --build -d
 docker compose run --rm migrate
 npm run docker:smoke
```

## Extension (VSCode)
```
cd extension
npm install
npm run compile
```

Run the extension in VSCode using the Extension Development Host.

### Settings
- `leakguard.apiUrl`: API base URL. Leave empty to keep everything local.
- `leakguard.languages`: Limit detection to language IDs.
- `leakguard.enableHighEntropy`: Optional high-entropy detection (default off).
- `leakguard.enableTelemetry`: Opt-in only (default off).

### Connect
Run `LeakGuard: Connect` to store API URL and ingestion token securely via VSCode SecretStorage. Use `LeakGuard: Disconnect` to clear the token.

### Ignore
- Add `.leakguardignore` at repo root (gitignore-like).
- Add `leakguard:ignore` inline comment for one-off exceptions.

### Quick Fix
- Replace with `process.env.LEAKGUARD_SECRET`
- Add `leakguard:ignore` comment (use sparingly)

## Security model
- Source code is never sent to the server.
- Payloads contain only: `type`, `file`, `line`, `previewMasked`, `fingerprint`.
- Sending is disabled by default unless `leakguard.apiUrl` is set.
- Previews are masked and truncated on both client and server.

## Verification checklist (copy/paste)
```
# root
npm install
npm run lint
npm run test
npm run build

# server
cd server
cp .env.example .env
npm run clean:prisma:windows
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev

# extension
cd ../extension
npm install
npm run compile
```

Manual test:
1. Open a file containing a sample secret like `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
2. Ensure diagnostics highlight the line.
3. Check LeakGuard Summary view shows findings.
4. Use Quick Fix to replace or ignore.
5. Confirm ignore comment suppresses the warning.

## Windows Prisma root cause (documented)
Commands run in this environment:
```
node -p "process.platform + ' ' + process.arch + ' ' + process.version"
# win32 arm64 v24.12.0

npx prisma -v
# prisma                : 6.19.2
# @prisma/client        : 6.19.2
# Computed binaryTarget : windows
# Operating System      : win32
# Architecture          : arm64
# Node.js               : v24.12.0
```

Why `query_engine-windows.dll.node is not a valid Win32 application` happens:
- Running on Windows ARM64 but Prisma only ships the **windows (x64)** engine, or
- Node is 32-bit while the engine is 64-bit.

Workarounds:
- Ensure `engineType = "binary"` and use binary engine envs in scripts: `PRISMA_CLIENT_ENGINE_TYPE=binary` and `PRISMA_CLI_QUERY_ENGINE_TYPE=binary`.
- Prefer the Docker path on Windows ARM64 (Prisma does not ship a `windows-arm64` binary target in v6).

## VSIX build
```
cd extension
npm run package
```

## Development notes
See `docs/decisions.md` and `docs/SECURITY.md`.
