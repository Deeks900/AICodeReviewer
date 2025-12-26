import * as vscode from 'vscode';

export class AiFixCodeActionProvider implements vscode.CodeActionProvider {
  static readonly kind = vscode.CodeActionKind.QuickFix;

  constructor(private proposedFixes: Map<string, string>) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const filePath = document.uri.fsPath;
    const fix = this.proposedFixes.get(filePath);
    if (!fix) return [];

    const action = new vscode.CodeAction(
      'Accept AI Fix',
      AiFixCodeActionProvider.kind
    );

    action.command = {
      command: 'aireview-mentor.acceptInlineFix',
      title: 'Accept AI Fix',
      arguments: [filePath]
    };

    return [action];
  }
}
