import test from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, hashToken } from '../dist/token.js';

test('generateToken uses base64url-safe chars', () => {
  const token = generateToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test('hashToken returns sha256 hex', () => {
  const hash = hashToken('example');
  assert.match(hash, /^[a-f0-9]{64}$/);
});
