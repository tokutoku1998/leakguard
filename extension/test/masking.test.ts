import assert from 'assert';
import { maskPreview, makeFingerprint, sanitizePreview } from '../src/masking';

describe('masking', () => {
  it('maskPreview redacts known match', () => {
    const line = 'const key = "sk-live-1234567890abcdef12345678";';
    const preview = maskPreview(line, 'sk-live-1234567890abcdef12345678');
    assert.ok(!preview.includes('sk-live-1234567890abcdef12345678'));
    assert.ok(preview.includes('[REDACTED]'));
  });

  it('sanitizePreview truncates and redacts tokens', () => {
    const longSecret = 'ghp_' + 'a'.repeat(36);
    const longLine = `${longSecret} ` + 'x'.repeat(200);
    const preview = sanitizePreview(longLine);
    assert.ok(!preview.includes(longSecret));
    assert.ok(preview.includes('[REDACTED]'));
    assert.ok(preview.length <= 120);
  });

  it('fingerprint is stable', () => {
    const fp1 = makeFingerprint(['type', 'file', '1', 'preview']);
    const fp2 = makeFingerprint(['type', 'file', '1', 'preview']);
    assert.strictEqual(fp1, fp2);
  });
});
