import fs from 'fs';

const ONE_MB = 1024 * 1024;

export function isLargeFile(filePath: string): boolean {
  const stat = fs.statSync(filePath);
  return stat.size > ONE_MB;
}

export function isBinaryFile(filePath: string): boolean {
  const buffer = fs.readFileSync(filePath, { encoding: null });
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.3;
}
