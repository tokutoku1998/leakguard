import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const baseUrl = process.env.LEAKGUARD_BASE_URL || 'http://localhost:3000';
const logPath = 'logs/quickstart.log';

function log(line) {
  fs.appendFileSync(logPath, `${line}\n`);
  console.log(line);
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  return { code: res.status ?? 1, stdout: res.stdout || '', stderr: res.stderr || '' };
}

async function main() {
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync(logPath, '', 'utf8');

  // 1) healthz
  const health = await fetch(`${baseUrl}/healthz`);
  log(`healthz: HTTP ${health.status}`);

  // 2) token mint
  const mint = run('npm', ['run', 'leakguard', '--', 'token', 'mint', '--project', 'demo-repo']);
  const token = (mint.stdout || '').trim();
  if (!token) {
    log('token mint: FAILED (no token returned)');
    process.exit(1);
  }
  log('token mint: OK (token not printed)');

  // 3) verify
  const verify = await fetch(`${baseUrl}/v1/auth/verify`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
  log(`verify: HTTP ${verify.status}`);

  // 4) post findings
  const payload = {
    repoId: 'demo-repo',
    userId: 'demo-user',
    findings: [
      {
        type: 'github_pat',
        file: 'demo.txt',
        line: 1,
        previewMasked: '[REDACTED]',
        fingerprint: 'fp_demo',
      },
    ],
  };
  const send = await fetch(`${baseUrl}/v1/findings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  log(`send: HTTP ${send.status}`);

  // 5) projects
  const projectsRes = await fetch(`${baseUrl}/v1/projects`, {
    headers: { authorization: `Bearer ${token}` },
  });
  log(`projects: HTTP ${projectsRes.status}`);
  const projects = await projectsRes.json();
  const projectId = projects?.[0]?.id;
  if (!projectId) {
    log('status change: SKIPPED (no project id)');
    process.exit(1);
  }

  // 6) find finding
  const findingRes = await fetch(`${baseUrl}/v1/projects/${projectId}/findings?status=open`, {
    headers: { authorization: `Bearer ${token}` },
  });
  log(`findings: HTTP ${findingRes.status}`);
  const findings = await findingRes.json();
  const findingId = findings?.[0]?.id;
  if (!findingId) {
    log('status change: SKIPPED (no finding id)');
    process.exit(1);
  }

  // 7) status change
  const statusRes = await fetch(`${baseUrl}/v1/findings/${findingId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'fixed' }),
  });
  log(`status change: HTTP ${statusRes.status}`);
}

main().catch((err) => {
  log(`error: ${String(err)}`);
  process.exit(1);
});
