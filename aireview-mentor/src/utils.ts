import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/* --------------------------
   GET GEMINI API KEY
---------------------------*/
export async function getGeminiApiKey(): Promise<string | undefined> {
    console.log("called")
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

function shouldIgnore(name: string): boolean {
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

function walk(dir: string, cb: (file: string) => void) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      if (shouldIgnore(entry)) continue;
      walk(fullPath, cb);
    } else {
      cb(fullPath);
    }
  }
}

/* --------------------------
   FILE TIMESTAMP LOGIC
---------------------------*/
export function captureTimestamps(dir: string): Map<string, number> {
  const timestamps = new Map<string, number>();

  walk(dir, (file) => {
    const stat = fs.statSync(file);
    timestamps.set(file, stat.mtimeMs);
  });

  return timestamps;
}

/* --------------------------
   RUN BACKEND REVIEW
---------------------------*/
export async function runReview(directoryPath: string, apiKey: string) {
  // Call your backend API
  await fetch('http://localhost:8000/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directoryPath, apiKey })
  });
}

export function detectModifiedFiles(
  before: Map<string, number>,
  after: Map<string, number>
): string[] {
  const modified: string[] = [];
  for (const [file, afterTime] of after.entries()) {
    const beforeTime = before.get(file);
    if (beforeTime && afterTime > beforeTime) modified.push(file);
  }
  return modified;
}

/* --------------------------
   HIGHLIGHT MODIFIED FILES
---------------------------*/
export function highlightModifiedFiles(files: string[]) {
  const modifiedSet = new Set(files.map(f => path.normalize(f)));

  const provider: vscode.FileDecorationProvider = {
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
export function readSummary(directoryPath: string): string {
  const summaryPath = path.join(directoryPath, 'CODE_REVIEW_SUMMARY.txt');
  if (!fs.existsSync(summaryPath)) return 'Summary file not found';
  return fs.readFileSync(summaryPath, 'utf-8');
}

export function showSummary(summary: string, files: string[]) {
  const panel = vscode.window.createWebviewPanel(
    'geminiSummary',
    'Gemini Code Review Summary',
    vscode.ViewColumn.One,
    {}
  );

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

export function readSummaryJson(dirPath: string): any | null {
    const summaryPath = path.join(dirPath, "CODE_REVIEW_SUMMARY.json");
    if (!fs.existsSync(summaryPath)) return null;

    try {
        const data = fs.readFileSync(summaryPath, "utf-8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}
