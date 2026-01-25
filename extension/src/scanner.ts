import * as vscode from 'vscode';
import path from 'path';
import { coreRules, highEntropyRule } from './rules';
import { isIgnoredByComment, isIgnoredPath, loadIgnore, resolveWorkspaceFolder } from './ignore';
import { isBinaryFile, isLargeFile } from './fileChecks';
import { maskPreview, makeFingerprint } from './masking';

export type Finding = {
  type: string;
  file: string;
  line: number;
  previewMasked: string;
  fingerprint: string;
};

export type ScanResult = {
  findings: Finding[];
  skipped: boolean;
  reason?: string;
};

function getRules(enableHighEntropy: boolean) {
  return enableHighEntropy ? [...coreRules, highEntropyRule] : coreRules;
}

function getAllowedLanguages(): string[] {
  const config = vscode.workspace.getConfiguration('leakguard');
  return config.get<string[]>('languages', []) || [];
}

function isLanguageAllowed(document: vscode.TextDocument): boolean {
  const allowed = getAllowedLanguages();
  if (!allowed.length) return true;
  return allowed.includes(document.languageId);
}

export function scanDocument(document: vscode.TextDocument): ScanResult {
  if (!isLanguageAllowed(document)) {
    return { findings: [], skipped: true, reason: 'language-filter' };
  }
  const workspaceFolder = resolveWorkspaceFolder(document);
  if (!workspaceFolder) {
    return { findings: [], skipped: true, reason: 'no-workspace' };
  }

  const filePath = document.uri.fsPath;
  const ig = loadIgnore(workspaceFolder);
  if (isIgnoredPath(ig, filePath, workspaceFolder)) {
    return { findings: [], skipped: true, reason: 'ignored' };
  }
  try {
    if (isLargeFile(filePath)) {
      return { findings: [], skipped: true, reason: 'large-file' };
    }
    if (isBinaryFile(filePath)) {
      return { findings: [], skipped: true, reason: 'binary' };
    }
  } catch (error) {
    return { findings: [], skipped: true, reason: 'file-error' };
  }

  const findings: Finding[] = [];
  const rules = getRules(vscode.workspace.getConfiguration('leakguard').get('enableHighEntropy', false));
  const relPath = path.relative(workspaceFolder, filePath).replace(/\\/g, '/');

  for (let i = 0; i < document.lineCount; i += 1) {
    const lineText = document.lineAt(i).text;
    if (isIgnoredByComment(lineText)) {
      continue;
    }
    for (const rule of rules) {
      const matches = lineText.matchAll(rule.pattern);
      for (const match of matches) {
        if (!match[0]) continue;
        const previewMasked = maskPreview(lineText, match[0]);
        const fingerprint = makeFingerprint([rule.type, relPath, String(i + 1), previewMasked]);
        findings.push({
          type: rule.type,
          file: relPath,
          line: i + 1,
          previewMasked,
          fingerprint,
        });
      }
    }
  }

  return { findings, skipped: false };
}
