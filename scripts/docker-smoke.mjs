import assert from 'node:assert/strict';

const baseUrl = process.env.LEAKGUARD_BASE_URL || 'http://localhost:3000';
const adminToken = process.env.LEAKGUARD_ADMIN_TOKEN || 'local-admin';

async function main() {
  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200, 'healthz status');

  const projectRes = await fetch(`${baseUrl}/v1/projects`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ repoId: 'smoke-repo', name: 'Smoke Repo' }),
  });
  assert.equal(projectRes.status, 200, 'project create status');
  const projectJson = await projectRes.json();
  const token = projectJson.ingestionToken;
  assert.ok(token, 'ingestion token present');

  const payload = {
    repoId: 'smoke-repo',
    userId: 'smoke-user',
    findings: [
      {
        type: 'github_pat',
        file: 'src/app.ts',
        line: 1,
        previewMasked: '[REDACTED]',
        fingerprint: 'fp_smoke',
      },
    ],
  };

  const postFindings = await fetch(`${baseUrl}/v1/findings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  assert.equal(postFindings.status, 200, 'post findings status');

  const listRes = await fetch(`${baseUrl}/v1/projects/org_default_smoke-repo/findings`);
  assert.equal(listRes.status, 200, 'get findings status');
  const findings = await listRes.json();
  assert.ok(Array.isArray(findings) && findings.length > 0, 'findings array');
  const findingId = findings[0].id;
  assert.ok(findingId, 'finding id');

  const statusRes = await fetch(`${baseUrl}/v1/findings/${findingId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'fixed' }),
  });
  assert.equal(statusRes.status, 200, 'status update');

  console.log('docker smoke ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
