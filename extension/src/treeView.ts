import * as vscode from 'vscode';
import { Finding } from './scanner';

export class SummaryProvider implements vscode.TreeDataProvider<SummaryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SummaryItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private findings: Finding[] = [];

  setFindings(findings: Finding[]) {
    this.findings = findings;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SummaryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SummaryItem[] {
    const counts = new Map<string, number>();
    for (const finding of this.findings) {
      counts.set(finding.type, (counts.get(finding.type) || 0) + 1);
    }
    return Array.from(counts.entries()).map(
      ([type, count]) => new SummaryItem(`${type} (${count})`, vscode.TreeItemCollapsibleState.None),
    );
  }
}

class SummaryItem extends vscode.TreeItem {
  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
  }
}
