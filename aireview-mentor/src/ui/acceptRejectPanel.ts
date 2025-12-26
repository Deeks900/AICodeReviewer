import * as vscode from 'vscode';
import * as path from 'path';

export function showAcceptRejectPanel(
  filePath: string,
  onAccept: () => void,
  onReject: () => void
) {
  const panel = vscode.window.createWebviewPanel(
    'aiReviewActions',
    'AI Review Actions',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: var(--vscode-font-family);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    padding: 16px;
  }
  h3 { margin-bottom: 6px; }
  .file { opacity: 0.7; margin-bottom: 16px; }
  button {
    padding: 8px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    margin-right: 10px;
  }
  .accept { background: #238636; color: white; }
  .reject { background: #da3633; color: white; }
</style>
</head>
<body>
  <h3>AI Review – Proposed Changes</h3>
  <div class="file">${path.basename(filePath)}</div>

  <button class="accept" onclick="accept()">✔ Accept</button>
  <button class="reject" onclick="reject()">✖ Reject</button>

<script>
  const vscode = acquireVsCodeApi();
  function accept() { vscode.postMessage({ cmd: 'accept' }); }
  function reject() { vscode.postMessage({ cmd: 'reject' }); }
</script>
</body>
</html>
`;

  panel.webview.onDidReceiveMessage(msg => {
    if (msg.cmd === 'accept') onAccept();
    if (msg.cmd === 'reject') onReject();
    panel.dispose();
  });
}
