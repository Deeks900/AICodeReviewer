"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.showAcceptRejectPanel = showAcceptRejectPanel;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
function showAcceptRejectPanel(filePath, original, modified, onAccept, onReject) {
    if (!filePath)
        return;
    const panel = vscode.window.createWebviewPanel('aiReviewActions', 'AI Review Actions', vscode.ViewColumn.Beside, { enableScripts: true });
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
        if (msg.cmd === 'accept')
            onAccept();
        if (msg.cmd === 'reject')
            onReject();
        panel.dispose();
    });
}
//# sourceMappingURL=acceptRejectPanel.js.map