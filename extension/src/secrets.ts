import * as vscode from 'vscode';

const TOKEN_KEY = 'leakguard.ingestionToken';

export async function setIngestionToken(secrets: vscode.SecretStorage, token: string) {
  await secrets.store(TOKEN_KEY, token);
}

export async function getIngestionToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  return secrets.get(TOKEN_KEY);
}
