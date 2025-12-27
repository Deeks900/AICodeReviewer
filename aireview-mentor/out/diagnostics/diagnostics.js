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
exports.applyDiagnostics = applyDiagnostics;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
function applyDiagnostics(collection, issues) {
    collection.clear();
    const map = new Map();
    for (const issue of issues) {
        if (!issue.file)
            continue;
        const file = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, issue.file);
        const range = new vscode.Range((issue.line || issue.line_start) - 1, 0, (issue.line_end || issue.line || issue.line_start) - 1, 999);
        const severity = issue.severity === 'CRITICAL'
            ? vscode.DiagnosticSeverity.Error
            : issue.severity === 'MAJOR'
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;
        const diag = new vscode.Diagnostic(range, `AIReview-Mentor: ${issue.comment}`, severity);
        if (!map.has(file))
            map.set(file, []);
        map.get(file).push(diag);
    }
    for (const [file, diags] of map) {
        collection.set(vscode.Uri.file(file), diags);
    }
}
//# sourceMappingURL=diagnostics.js.map