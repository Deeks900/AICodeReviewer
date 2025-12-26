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
exports.showSmartSummary = showSmartSummary;
const vscode = __importStar(require("vscode"));
function showSmartSummary(summary, modifiedFiles) {
    const panel = vscode.window.createWebviewPanel('aiReviewSummary', 'AI Review Summary', vscode.ViewColumn.One, {});
    const critical = summary.issues.filter((i) => i.severity === 'CRITICAL').length;
    const major = summary.issues.filter((i) => i.severity === 'MAJOR').length;
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
//# sourceMappingURL=summaryPanel.js.map