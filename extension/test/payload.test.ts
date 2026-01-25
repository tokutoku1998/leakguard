import assert from 'assert';
import { toPayload } from '../src/payload';

describe('payload', () => {
  it('payload contains masked preview only', () => {
    const findings = [
      {
        type: 'openai_api_key',
        file: 'src/app.ts',
        line: 3,
        previewMasked: 'sk-1234567890abcdef1234567890abcdef',
        fingerprint: 'abc123',
      },
    ];

    const payload = toPayload(findings, 'repo', 'user');
    const body = JSON.stringify(payload);
    assert.ok(body.includes('[REDACTED]'));
    assert.ok(!body.includes('sk-'));
  });
});
