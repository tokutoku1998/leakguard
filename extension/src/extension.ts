import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { scanDocument, Finding } from './scanner';
import { SummaryProvider } from './treeView';
import { sendFindings } from './sender';
import { getIngestionToken, setIngestionToken } from './secrets';

const DIAG_SOURCE = 'LeakGuard';

function toDiagnostic(finding: Finding): vscode.Diagnostic {
  const range = new vscode.Range(
    new vscode.Position(finding.line - 1, 0),
    new vscode.Position(finding.line - 1, Math.max(1, finding.previewMasked.length)),
  );
  const diag = new vscode.Diagnostic(
    range,
    `Possible secret: ${finding.type}. Use env vars or secret store.`,
    vscode.DiagnosticSeverity.Warning,
  );
  diag.source = DIAG_SOURCE;
  diag.code = finding.type;
  return diag;
}

function getLineCommentPrefix(languageId: string): string {
  if (['python', 'yaml', 'yml', 'shellscript', 'makefile'].includes(languageId)) return '#';
  return '//';
}

async function verifyToken(apiUrl: string, token: string): Promise<boolean> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/auth/verify`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
  return response.ok;
}

class LeakGuardCodeActions implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const diagnostics = context.diagnostics.filter((d) => d.source === DIAG_SOURCE);
    if (!diagnostics.length) return actions;

    const replaceAction = new vscode.CodeAction('LeakGuard: Replace with process.env.SECRET', vscode.CodeActionKind.QuickFix);
    replaceAction.edit = new vscode.WorkspaceEdit();
    replaceAction.edit.replace(document.uri, range, 'process.env.LEAKGUARD_SECRET');
    actions.push(replaceAction);

    const ignoreAction = new vscode.CodeAction('LeakGuard: Ignore this line (use sparingly)', vscode.CodeActionKind.QuickFix);
    const line = document.lineAt(range.start.line);
    const prefix = getLineCommentPrefix(document.languageId);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, line.range, `${line.text} ${prefix} leakguard:ignore`);
    ignoreAction.edit = edit;
    actions.push(ignoreAction);

    return actions;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('LeakGuard');
  const diagnostics = vscode.languages.createDiagnosticCollection(DIAG_SOURCE);
  const summaryProvider = new SummaryProvider();

  const getToken = async () => getIngestionToken(context.secrets);

  context.subscriptions.push(diagnostics, output);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('leakguard.summary', summaryProvider),
  );
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, new LeakGuardCodeActions(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('leakguard.connect', async () => {
      const apiUrl = await vscode.window.showInputBox({
        prompt: 'LeakGuard API URL',
        placeHolder: 'http://localhost:3000',
        value: vscode.workspace.getConfiguration('leakguard').get('apiUrl', ''),
      });
      if (!apiUrl) return;

      const token = await vscode.window.showInputBox({
        prompt: 'LeakGuard ingestion token',
        password: true,
      });
      if (!token) return;

      try {
        const ok = await verifyToken(apiUrl, token);
        if (!ok) {
          output.appendLine('LeakGuard: token verification failed.');
          return;
        }
      } catch (error) {
        output.appendLine(`LeakGuard: token verification error: ${String(error)}`);
        return;
      }

      await vscode.workspace.getConfiguration('leakguard').update('apiUrl', apiUrl, vscode.ConfigurationTarget.Global);
      await setIngestionToken(context.secrets, token);
      vscode.window.showInformationMessage('LeakGuard connected.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('leakguard.disconnect', async () => {
      await context.secrets.delete('leakguard.ingestionToken');
      output.appendLine('LeakGuard: token cleared.');
    }),
  );

  async function scanAndPublish(document: vscode.TextDocument) {
    const result = scanDocument(document);
    if (result.skipped) {
      output.appendLine(`LeakGuard: skipped ${document.fileName} (${result.reason})`);
      return;
    }
    const diags = result.findings.map(toDiagnostic);
    diagnostics.set(document.uri, diags);
    summaryProvider.setFindings(result.findings);
    await sendFindings(result.findings, output, getToken);
  }

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await scanAndPublish(document);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('leakguard.scanFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await scanAndPublish(editor.document);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('leakguard.scanWorkspace', async () => {
      const files = await vscode.workspace.findFiles('**/*', '**/{node_modules,.git,dist,out,build}/**');
      const allFindings: Finding[] = [];
      for (const uri of files) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const result = scanDocument(doc);
        if (!result.skipped) {
          allFindings.push(...result.findings);
          diagnostics.set(doc.uri, result.findings.map(toDiagnostic));
        }
      }
      summaryProvider.setFindings(allFindings);
      await sendFindings(allFindings, output, getToken);
    }),
  );
}

export function deactivate() {}
