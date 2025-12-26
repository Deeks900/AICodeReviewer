import * as vscode from 'vscode';

export function showSmartSummary(
  summary: any,
  modifiedFiles: string[]
) {
  const panel = vscode.window.createWebviewPanel(
    'aiReviewSummary',
    'AI Review Summary',
    vscode.ViewColumn.One,
    {}
  );

  const critical = summary.issues.filter((i:any)=>i.severity==='CRITICAL').length;
  const major = summary.issues.filter((i:any)=>i.severity==='MAJOR').length;

  panel.webview.html = `
  <html>
  <body style="font-family: var(--vscode-font-family); padding:16px;">
    <h2>AI Review Summary</h2>
    <ul>
      <li>Total Issues: <b>${summary.issues.length}</b></li>
      <li>Critical: <b style="color:#da3633">${critical}</b></li>
      <li>Major: <b style="color:#d29922">${major}</b></li>
      <li>Files Modified: <b>${modifiedFiles.length}</b></li>
    </ul>
  </body>
  </html>
  `;
}
