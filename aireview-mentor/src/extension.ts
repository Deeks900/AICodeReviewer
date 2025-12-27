// -------------------- IMPORTS --------------------
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
  getGeminiApiKey,
  captureTimestamps,
  runReview,
  detectModifiedFiles,
  highlightModifiedFiles,
  readSummary,
  readSummaryJson, // Reads CODE_REVIEW_SUMMARY.json
} from './utils';

import { showDiffPreview } from './diff/diffPreview';
import { showAcceptRejectPanel } from './ui/acceptRejectPanel';
import { applyDiagnostics } from './diagnostics/diagnostics';
import { AiFixCodeActionProvider } from './codeActions/aiFixCodeAction';
import { showSmartSummary } from './ui/summaryPanel';

// -------------------- GLOBAL STATE --------------------
let diagnostics: vscode.DiagnosticCollection;

/** Snapshot of original files before AI runs */
const originalFileContents = new Map<string, string>();

/** Proposed AI-fixed content for Code Actions and Accept/Reject panel */
const proposedFixes = new Map<string, string>();

// -------------------- UTILS --------------------
function walk(dir: string, cb: (file: string) => void) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (['node_modules', '.git', '.vscode', '__pycache__'].includes(entry)) continue;
      walk(full, cb);
    } else {
      cb(full);
    }
  }
}

// -------------------- ACTIVATE --------------------
export function activate(context: vscode.ExtensionContext) {
  console.log('AIReview-Mentor activated');

  diagnostics = vscode.languages.createDiagnosticCollection('AIReview');

  // -------------------- INLINE CODE ACTION SUPPORT --------------------
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      '*',
      new AiFixCodeActionProvider(proposedFixes),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'aireview-mentor.acceptInlineFix',
      (filePath: string) => {
        const fix = proposedFixes.get(filePath);
        if (!fix) return;

        fs.writeFileSync(filePath, fix, 'utf-8');
        vscode.window.showInformationMessage(`AI fix applied: ${path.basename(filePath)}`);
        proposedFixes.delete(filePath);
      }
    )
  );

  // -------------------- MAIN COMMAND --------------------
  const reviewCommand = vscode.commands.registerCommand(
    'aireview-mentor.review-mentor',
    async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) {
        vscode.window.showErrorMessage('Please open a workspace folder');
        return;
      }

      const root = folder.uri.fsPath;

      // -------------------- STEP 1: SNAPSHOT FILES --------------------
      originalFileContents.clear();
      walk(root, file => {
        try {
          originalFileContents.set(file, fs.readFileSync(file, 'utf-8'));
        } catch {
          // Ignore binary files
        }
      });

      // -------------------- STEP 2: GEMINI API KEY --------------------
      const apiKey = await getGeminiApiKey();
      if (!apiKey) return;

      const summaryJsonPath = path.join(root, 'CODE_REVIEW_SUMMARY.json');
      const alreadyReviewed = fs.existsSync(summaryJsonPath);

      const before = captureTimestamps(root);

      // -------------------- STEP 3: RUN GEMINI --------------------
      if (!alreadyReviewed) {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'AI Reviewing…' },
          async () => {
            await runReview(root, apiKey);
          }
        );
      } else {
        vscode.window.showInformationMessage('Using existing AI review summary.');
      }

      // -------------------- STEP 4: POST-PROCESS --------------------
      const after = captureTimestamps(root);
      const modifiedFiles = detectModifiedFiles(before, after);
      highlightModifiedFiles(modifiedFiles);

      // -------------------- STEP 5: READ JSON SUMMARY --------------------
      const summaryJson = readSummaryJson(root);
      let issueFiles = new Set<string>();
      if (summaryJson && Array.isArray(summaryJson.issues)) {
        applyDiagnostics(diagnostics, summaryJson.issues);
        showSmartSummary(summaryJson, modifiedFiles);
        issueFiles = new Set(summaryJson.issues.map((i: any) => i.file).filter((f: any) => f));
      } else {
        vscode.window.showWarningMessage('AI review summary not found or invalid JSON.');
      }

      // -------------------- STEP 6: DIFF + ACCEPT/REJECT PANEL --------------------
      for (const file of issueFiles) {
        if (!file) continue;
        const original = originalFileContents.get(file);
        if (!original) continue;

        const modified = fs.readFileSync(file, 'utf-8');
        proposedFixes.set(file, modified);

        // Show diff preview (non-blocking)
        await showDiffPreview(file, original, modified);

        // Show Accept/Reject panel
        showAcceptRejectPanel(
          file,
          original,
          modified,
          () => fs.writeFileSync(file, modified), // Accept
          () => fs.writeFileSync(file, original)  // Reject
        );
      }
    }
  );

  context.subscriptions.push(reviewCommand, diagnostics);
}

// -------------------- DEACTIVATE --------------------
export function deactivate() {}
