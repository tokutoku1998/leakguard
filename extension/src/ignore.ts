import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import * as vscode from 'vscode';

const IGNORE_FILE = '.leakguardignore';

export function loadIgnore(workspaceFolder: string): ReturnType<typeof ignore> | null {
  const ig = ignore();
  const ignorePath = path.join(workspaceFolder, IGNORE_FILE);
  if (!fs.existsSync(ignorePath)) {
    return null;
  }
  const content = fs.readFileSync(ignorePath, 'utf8');
  ig.add(content.split(/\r?\n/));
  return ig;
}

export function isIgnoredByComment(line: string): boolean {
  return line.includes('leakguard:ignore');
}

export function isIgnoredPath(ig: ReturnType<typeof ignore> | null, filePath: string, workspaceFolder: string): boolean {
  if (!ig) return false;
  const rel = path.relative(workspaceFolder, filePath).replace(/\\/g, '/');
  return ig.ignores(rel);
}

export function resolveWorkspaceFolder(document: vscode.TextDocument): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return null;
  return folder.uri.fsPath;
}
