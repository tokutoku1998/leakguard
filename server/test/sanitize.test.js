import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePreview, sanitizeSlackText } from '../dist/sanitize.js';

test('sanitizePreview redacts and truncates', () => {
  const secret = 'sk-' + 'a'.repeat(40);
  const input = `${secret} ` + 'x'.repeat(200);
  const output = sanitizePreview(input);
  assert.ok(!output.includes(secret));
  assert.ok(output.includes('[REDACTED]'));
  assert.ok(output.length <= 120);
});

test('sanitizeSlackText redacts token-like values', () => {
  const secret = 'ghp_' + 'b'.repeat(36);
  const text = `LeakGuard sample ${secret} end`;
  const output = sanitizeSlackText(text);
  assert.ok(!output.includes(secret));
  assert.ok(output.includes('[REDACTED]'));
});
