const MAX_PREVIEW_LEN = 120;

function clampPreview(input: string): string {
  const singleLine = input.replace(/\r?\n/g, ' ');
  if (singleLine.length <= MAX_PREVIEW_LEN) {
    return singleLine;
  }
  return singleLine.slice(0, MAX_PREVIEW_LEN - 1) + 'c';
}

function redactKnownTokens(input: string): string {
  const tokenLike = /[A-Za-z0-9_-]{20,}/g;
  return input.replace(tokenLike, '[REDACTED]');
}

export function sanitizePreview(input: string): string {
  return clampPreview(redactKnownTokens(input));
}

export function sanitizeSlackText(input: string): string {
  return redactKnownTokens(input);
}
