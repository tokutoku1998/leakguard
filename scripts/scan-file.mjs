import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_PREVIEW_LEN = 120;

const rules = [
  { type: 'aws_access_key_id', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'github_pat', pattern: /\bghp_[A-Za-z0-9]{36}\b/g },
  { type: 'github_token', pattern: /\bgho_[A-Za-z0-9]{36}\b/g },
  { type: 'slack_token', pattern: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}\b/g },
  { type: 'stripe_secret_key', pattern: /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/g },
  { type: 'openai_api_key', pattern: /\bsk-[A-Za-z0-9]{32,}\b/g },
];

function clampPreview(input) {
  const singleLine = input.replace(/\r?\n/g, ' ');
  if (singleLine.length <= MAX_PREVIEW_LEN) return singleLine;
  return singleLine.slice(0, MAX_PREVIEW_LEN - 1) + 'c';
}

function redactKnownTokens(input) {
  const tokenLike = /[A-Za-z0-9_-]{20,}/g;
  return input.replace(tokenLike, '[REDACTED]');
}

function sanitizePreview(input) {
  return clampPreview(redactKnownTokens(input));
}

function makeFingerprint(parts) {
  const hash = crypto.createHash('sha256');
  hash.update(parts.join('|'));
  return hash.digest('hex');
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.basename(filePath);
  const lines = content.split(/\r?\n/);
  const findings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineText = lines[i];
    for (const rule of rules) {
      const matches = lineText.matchAll(rule.pattern);
      for (const match of matches) {
        if (!match[0]) continue;
        const previewMasked = sanitizePreview(lineText.replace(match[0], '[REDACTED]'));
        const fingerprint = makeFingerprint([rule.type, relPath, String(i + 1), previewMasked]);
        findings.push({
          type: rule.type,
          file: relPath,
          line: i + 1,
          previewMasked,
          fingerprint,
        });
      }
    }
  }

  return findings;
}

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/scan-file.mjs <path>');
  process.exit(1);
}

const findings = scanFile(target);
const payload = {
  repoId: 'demo-repo',
  userId: 'demo',
  findings,
};

process.stdout.write(JSON.stringify(payload));
