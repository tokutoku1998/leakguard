import { Finding } from './scanner';
import { sanitizePreview } from './masking';

export function toPayload(findings: Finding[], repoId: string, userId: string) {
  return {
    repoId,
    userId,
    findings: findings.map((f) => ({
      type: f.type,
      file: f.file,
      line: f.line,
      previewMasked: sanitizePreview(f.previewMasked),
      fingerprint: f.fingerprint,
    })),
  };
}
