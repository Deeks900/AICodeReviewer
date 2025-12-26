import * as vscode from 'vscode';

export function showExplainFix(
  explanation: string
) {
  const panel = vscode.window.createWebviewPanel(
    'aiExplainFix',
    'Explain My Fixes',
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = `
  <html>
  <body style="font-family: var(--vscode-font-family); padding:16px;">
    <h3>Why AI Suggested This</h3>
    <p>${explanation}</p>
  </body>
  </html>
  `;
}
