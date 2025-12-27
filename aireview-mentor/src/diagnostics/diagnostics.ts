import * as vscode from 'vscode';
import * as path from 'path';

export function applyDiagnostics(
  collection: vscode.DiagnosticCollection,
  issues: any[]
) {
  collection.clear();
  const map = new Map<string, vscode.Diagnostic[]>();

  for (const issue of issues) {
    if (!issue.file) continue;
    const file = path.join(
      vscode.workspace.workspaceFolders![0].uri.fsPath,
      issue.file
    );

    const range = new vscode.Range(
      issue.line_start - 1,
      0,
      issue.line_end - 1,
      999
    );

    const severity =
      issue.severity === 'CRITICAL'
        ? vscode.DiagnosticSeverity.Error
        : issue.severity === 'MAJOR'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

    const diag = new vscode.Diagnostic(
      range,
      `AIReview-Mentor: ${issue.comment}`,
      severity
    );

    if (!map.has(file)) map.set(file, []);
    map.get(file)!.push(diag);
  }

  for (const [file, diags] of map) {
    collection.set(vscode.Uri.file(file), diags);
  }
}
