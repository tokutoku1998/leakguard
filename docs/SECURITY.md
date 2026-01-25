# Security

## Data minimization
- The extension never sends raw source code.
- Payloads are strictly limited to: `type`, `file` (relative), `line`, `previewMasked`, `fingerprint`.
- `previewMasked` is always masked and truncated on both client and server.

## Masking
- Client: token-like sequences are redacted and previews are length-limited before any outbound request.
- Server: previews are re-sanitized before storage, and Slack messages are sanitized before send.

## Local-first + opt-in sending
- By default, the extension runs local-only.
- Network send happens only when `leakguard.apiUrl` is set.
- Telemetry is opt-in and disabled by default.

## Ingestion auth
- Findings ingestion requires `Authorization: Bearer <ingestionToken>`.
- Tokens are generated per project and stored hashed.
- Admin-only endpoint `/v1/projects` returns a token once.
- VSCode stores tokens in SecretStorage (not settings.json).

## Logging safeguards
- Fastify logger redacts authorization headers and token fields before output.
- Authorization is never logged by the server (redaction is enforced at logger configuration).

## Input validation + limits
- Zod validates all request payloads.
- Fastify body limit is set to 256KB.
- Findings payload is capped at 200 entries per request.

## XSS & output safety
- Dashboard HTML escapes all dynamic output.

## Audit logging
- Every findings ingest and status update writes an audit log entry.
