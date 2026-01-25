import fs from 'node:fs';

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

function tailLines(content, count) {
  const lines = content.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - count)).join('\n');
}

const proofPath = process.argv[2] || 'beta-proof.txt';
const dockerLog = process.argv[3] || 'logs/docker-smoke.log';
const quickLog = process.argv[4] || 'logs/quickstart.log';

const proof = fs.existsSync(proofPath) ? fs.readFileSync(proofPath, 'utf8') : '';
const docker = fs.existsSync(dockerLog) ? fs.readFileSync(dockerLog, 'utf8') : '';
const quick = fs.existsSync(quickLog) ? fs.readFileSync(quickLog, 'utf8') : '';

const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const badgeUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/badge.svg?branch=${process.env.GITHUB_REF_NAME}`;
const commitSha = process.env.GITHUB_SHA || 'UNKNOWN';

const headerEndIdx = proof.indexOf('(3)');
const header = headerEndIdx > 0 ? proof.slice(0, headerEndIdx).trim() : proof.trim();

const summary = [
  '## LeakGuard Beta Proof (Summary)',
  `Run URL: ${runUrl}`,
  `Badge URL: ${badgeUrl}`,
  `Commit SHA: ${commitSha}`,
  '',
  '### beta-proof.txt (header excerpt)',
  '```',
  redact(header),
  '```',
  '### docker-smoke (last 50 lines)',
  '```',
  redact(tailLines(docker, 50)),
  '```',
  '### quickstart (last 50 lines)',
  '```',
  redact(tailLines(quick, 50)),
  '```',
].join('\n');

process.stdout.write(summary);
