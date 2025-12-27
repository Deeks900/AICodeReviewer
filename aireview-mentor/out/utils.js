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
exports.getGeminiApiKey = getGeminiApiKey;
exports.captureTimestamps = captureTimestamps;
exports.runReview = runReview;
exports.detectModifiedFiles = detectModifiedFiles;
exports.highlightModifiedFiles = highlightModifiedFiles;
exports.readSummary = readSummary;
exports.showSummary = showSummary;
exports.readSummaryJson = readSummaryJson;
exports.explainCode = explainCode;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/* --------------------------
   GET GEMINI API KEY
---------------------------*/
async function getGeminiApiKey() {
    console.log("called");
    // Ask user
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API Key',
        ignoreFocusOut: true,
        password: true
    });
    if (!apiKey) {
        vscode.window.showErrorMessage('Gemini API Key is required!');
        return undefined;
    }
    return apiKey;
}
function shouldIgnore(name) {
    return [
        'node_modules',
        '.git',
        '.vscode',
        '__pycache__',
        'dist',
        'build',
        'coverage',
        'venv',
        '.venv'
    ].includes(name);
}
function walk(dir, cb) {
    for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
            if (shouldIgnore(entry))
                continue;
            walk(fullPath, cb);
        }
        else {
            cb(fullPath);
        }
    }
}
/* --------------------------
   FILE TIMESTAMP LOGIC
---------------------------*/
function captureTimestamps(dir) {
    const timestamps = new Map();
    walk(dir, (file) => {
        const stat = fs.statSync(file);
        timestamps.set(file, stat.mtimeMs);
    });
    return timestamps;
}
/* --------------------------
   RUN BACKEND REVIEW
---------------------------*/
async function runReview(directoryPath, apiKey) {
    const response = await fetch('http://localhost:8000/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryPath, apiKey })
    });
    if (!response.ok) {
        throw new Error(`Backend review failed: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    if (result.status !== 'success') {
        throw new Error(`Review failed: ${result.message || 'Unknown error'}`);
    }
}
function detectModifiedFiles(before, after) {
    const modified = [];
    for (const [file, afterTime] of after.entries()) {
        const beforeTime = before.get(file);
        if (beforeTime && afterTime > beforeTime)
            modified.push(file);
    }
    return modified;
}
/* --------------------------
   HIGHLIGHT MODIFIED FILES
---------------------------*/
function highlightModifiedFiles(files) {
    const modifiedSet = new Set(files.map(f => path.normalize(f)));
    const provider = {
        provideFileDecoration(uri) {
            if (modifiedSet.has(path.normalize(uri.fsPath))) {
                return {
                    badge: '✔',
                    tooltip: 'Modified by Gemini Reviewer',
                    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
                };
            }
        }
    };
    vscode.window.registerFileDecorationProvider(provider);
    vscode.window.showInformationMessage(`Gemini modified ${files.length} file(s)`);
}
/* --------------------------
   SUMMARY PANEL
---------------------------*/
function readSummary(directoryPath) {
    const summaryPath = path.join(directoryPath, 'CODE_REVIEW_SUMMARY.txt');
    if (!fs.existsSync(summaryPath))
        return 'Summary file not found';
    return fs.readFileSync(summaryPath, 'utf-8');
}
function showSummary(summary, files) {
    const panel = vscode.window.createWebviewPanel('geminiSummary', 'Gemini Code Review Summary', vscode.ViewColumn.One, {});
    panel.webview.html = `
    <html>
      <body style="font-family: Arial; padding: 16px;">
        <h3>Modified Files</h3>
        <ul>${files.map(f => `<li>${f}</li>`).join('')}</ul>
        <h3>Summary</h3>
        <pre>${summary}</pre>
      </body>
    </html>
  `;
}
function readSummaryJson(dirPath) {
    const summaryPath = path.join(dirPath, "CODE_REVIEW_SUMMARY.json");
    if (!fs.existsSync(summaryPath))
        return null;
    try {
        const data = fs.readFileSync(summaryPath, "utf-8");
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
/* --------------------------
   EXPLAIN CODE
---------------------------*/
async function explainCode(code, language, apiKey) {
    const response = await fetch('http://localhost:8000/explain', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            code,
            language,
            apiKey,
        }),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.explanation;
}
//# sourceMappingURL=utils.js.map