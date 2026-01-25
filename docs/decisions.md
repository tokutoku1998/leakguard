# Decisions

- 2026-01-23: Started with a minimal monorepo using npm workspaces for faster onboarding.
- 2026-01-23: Server uses SQLite for development. For production PostgreSQL, plan is to switch Prisma provider and run migrations; this keeps MVP simple while meeting local-first dev needs.
- 2026-01-23: Default org/user/project are auto-created from repoId/userId to avoid blocking on auth in MVP.
- 2026-01-23: Extension sends only masked previews and fingerprints, and only when `leakguard.apiUrl` is set.
- 2026-01-23: High-entropy detection is optional and disabled by default to reduce false positives.
- 2026-01-23: Added ingestion tokens (hashed per project) and admin-only project creation endpoint; findings ingestion now requires Bearer token.
- 2026-01-23: Added server-side sanitization for previews and Slack payloads as a defense-in-depth measure.
- 2026-01-23: Upgraded Prisma to v6.19.2 to support Node 24 while keeping schema compatibility.
- 2026-01-23: Switched Prisma to binary engine defaults and added cross-env scripts for Windows reliability; documented Docker fallback for Windows ARM64 where Prisma lacks a native engine.
- 2026-01-23: Added CLI token mint command that prints tokens once and stores only hashes.
- 2026-01-23: Added /healthz endpoint and Docker smoke test as the canonical verification path for public beta readiness.
- 2026-01-23: Added VSCode Connect command and SecretStorage for ingestion tokens; removed token from settings.
- 2026-01-23: Pinned Prisma and Node versions (Node 22 LTS) to avoid silent breakage; CI runs on Node 22.
- 2026-01-23: Added docker:smoke Node script as the canonical cross-platform smoke test.
- 2026-01-23: Added /v1/auth/verify for Connect token verification and redacted authorization logs at the Fastify logger.
