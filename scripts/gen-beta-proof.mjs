import fs from 'node:fs';
import path from 'node:path';

function redact(content) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (/Bearer\s+/i.test(line) || /Authorization:/i.test(line)) {
        return '[REDACTED]';
      }
      return line;
    })
    .join('\n');
}

function readFileSafe(filePath) {
  if (!filePath) return '';
  if (!fs.existsSync(filePath)) return `Missing log file: ${filePath}`;
  return fs.readFileSync(filePath, 'utf8');
}

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const dockerLog = getArg('--docker');
const quickstartLog = getArg('--quickstart');
const outPath = getArg('--out') || 'beta-proof.txt';

const repo = process.env.GITHUB_REPOSITORY || 'OWNER/REPO';
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : 'UNKNOWN';
const refName = process.env.GITHUB_REF_NAME || 'main';
const badgeUrl = `https://github.com/${repo}/actions/workflows/ci.yml/badge.svg?branch=${refName}`;

const dockerContent = redact(readFileSafe(dockerLog));
const quickstartContent = redact(readFileSafe(quickstartLog));

const output = [
  '=== LeakGuard Beta Proof ===',
  new Date().toISOString(),
  '',
  '(1) Actions run URL:',
  runUrl,
  '',
  '(2) Badge URL:',
  badgeUrl,
  '',
  '(3) Docker smoke logs:',
  dockerContent,
  '',
  '(Quickstart: headless API verification)',
  quickstartContent,
  '',
  '=== END ===',
].join('\n');

fs.writeFileSync(outPath, output, 'utf8');
