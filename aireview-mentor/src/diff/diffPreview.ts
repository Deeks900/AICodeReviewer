import * as vscode from 'vscode';
import * as path from 'path';

function getLanguage(file: string): string {
  return {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.java': 'java'
  }[path.extname(file)] || 'plaintext';
}

export async function showDiffPreview(
  filePath: string,
  original: string,
  modified: string
) {
  const language = getLanguage(filePath);

  const originalUri = vscode.Uri.file(filePath);

  const modifiedDoc = await vscode.workspace.openTextDocument({
    language,
    content: modified
  });

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalUri,
    modifiedDoc.uri,
    'AI Review – Proposed Changes'
  );
}
