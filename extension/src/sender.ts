import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { Finding } from './scanner';
import { toPayload } from './payload';

export async function sendFindings(
  findings: Finding[],
  output: vscode.OutputChannel,
  getToken: () => Promise<string | undefined>,
): Promise<void> {
  const config = vscode.workspace.getConfiguration('leakguard');
  const apiUrl = config.get<string>('apiUrl', '').trim();
  if (!apiUrl) {
    return;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  const repoId = workspace?.name || 'unknown';
  const userId = process.env.USER || process.env.USERNAME || 'local-user';
  const payload = toPayload(findings, repoId, userId);
  const ingestionToken = (await getToken())?.trim();

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/findings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ingestionToken ? { authorization: `Bearer ${ingestionToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      output.appendLine(`LeakGuard: API error ${response.status}`);
    }
  } catch (error) {
    output.appendLine(`LeakGuard: API unreachable: ${String(error)}`);
  }
}
