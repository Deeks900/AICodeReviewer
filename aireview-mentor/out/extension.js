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
exports.activate = activate;
exports.deactivate = deactivate;
// -------------------- IMPORTS --------------------
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("./utils");
const diffPreview_1 = require("./diff/diffPreview");
const acceptRejectPanel_1 = require("./ui/acceptRejectPanel");
const diagnostics_1 = require("./diagnostics/diagnostics");
const aiFixCodeAction_1 = require("./codeActions/aiFixCodeAction");
const summaryPanel_1 = require("./ui/summaryPanel");
// -------------------- GLOBAL STATE --------------------
let diagnostics;
/** Snapshot of original files before AI runs */
const originalFileContents = new Map();
/** Proposed AI-fixed content for Code Actions and Accept/Reject panel */
const proposedFixes = new Map();
/** Issues tree data */
let issuesData = [];
// -------------------- STATUS BAR --------------------
let statusBarItem;
// -------------------- TREE DATA PROVIDER --------------------
class IssuesTreeProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level: group by severity
            const critical = issuesData.filter(i => i.severity.toLowerCase() === 'critical');
            const major = issuesData.filter(i => i.severity.toLowerCase() === 'major');
            const minor = issuesData.filter(i => i.severity.toLowerCase() === 'minor');
            return Promise.resolve([
                new IssueItem('Critical Issues', `${critical.length}`, vscode.TreeItemCollapsibleState.Expanded, critical, 'critical'),
                new IssueItem('Major Issues', `${major.length}`, vscode.TreeItemCollapsibleState.Expanded, major, 'major'),
                new IssueItem('Minor Issues', `${minor.length}`, vscode.TreeItemCollapsibleState.Expanded, minor, 'minor')
            ]);
        }
        else {
            // Child level: individual issues
            return Promise.resolve(element.issues.map(issue => new IssueItem(`${issue.file.split('/').pop()}:${issue.line_start} - ${issue.comment.substring(0, 50)}...`, '', vscode.TreeItemCollapsibleState.None, [], issue.severity.toLowerCase(), issue)));
        }
    }
}
class IssueItem extends vscode.TreeItem {
    label;
    description;
    collapsibleState;
    issues;
    severity;
    issue;
    constructor(label, description, collapsibleState, issues, severity, issue) {
        super(label, collapsibleState);
        this.label = label;
        this.description = description;
        this.collapsibleState = collapsibleState;
        this.issues = issues;
        this.severity = severity;
        this.issue = issue;
        this.description = description;
        this.tooltip = issue ? issue.comment : label;
        this.iconPath = this.getIcon();
        this.command = issue ? {
            command: 'aireview-mentor.openIssue',
            title: 'Open Issue',
            arguments: [issue]
        } : undefined;
    }
    getIcon() {
        switch (this.severity) {
            case 'critical': return new vscode.ThemeIcon('error', new vscode.ThemeColor('notificationsErrorIcon.foreground'));
            case 'major': return new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'));
            case 'minor': return new vscode.ThemeIcon('info', new vscode.ThemeColor('notificationsInfoIcon.foreground'));
            default: return new vscode.ThemeIcon('issue-opened');
        }
    }
}
// -------------------- UTILS --------------------
function walk(dir, cb) {
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
            if (['node_modules', '.git', '.vscode', '__pycache__'].includes(entry))
                continue;
            walk(full, cb);
        }
        else {
            cb(full);
        }
    }
}
// -------------------- ACTIVATE --------------------
function activate(context) {
    console.log('AIReview-Mentor activated');
    diagnostics = vscode.languages.createDiagnosticCollection('AIReview');
    // -------------------- STATUS BAR --------------------
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'aireview-mentor.review-mentor';
    statusBarItem.text = '$(search) AI Review';
    statusBarItem.tooltip = 'Run AI Code Review';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // -------------------- TREE VIEW --------------------
    const issuesProvider = new IssuesTreeProvider();
    vscode.window.registerTreeDataProvider('aiReviewIssues', issuesProvider);
    const refreshIssues = () => issuesProvider.refresh();
    // -------------------- INLINE CODE ACTION SUPPORT --------------------
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('*', new aiFixCodeAction_1.AiFixCodeActionProvider(proposedFixes), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }));
    context.subscriptions.push(vscode.commands.registerCommand('aireview-mentor.acceptInlineFix', (filePath) => {
        const fix = proposedFixes.get(filePath);
        if (!fix)
            return;
        fs.writeFileSync(filePath, fix, 'utf-8');
        vscode.window.showInformationMessage(`AI fix applied: ${path.basename(filePath)}`);
        proposedFixes.delete(filePath);
    }));
    // -------------------- OPEN ISSUE COMMAND --------------------
    context.subscriptions.push(vscode.commands.registerCommand('aireview-mentor.openIssue', (issue) => {
        const uri = vscode.Uri.file(issue.file);
        vscode.workspace.openTextDocument(uri).then(doc => {
            vscode.window.showTextDocument(doc).then(editor => {
                const range = new vscode.Range(issue.line_start - 1, 0, issue.line_end - 1, 999);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.start);
            });
        });
    }));
    // -------------------- EXPLAIN CODE COMMAND --------------------
    context.subscriptions.push(vscode.commands.registerCommand('aireview-mentor.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select some code to explain.');
            return;
        }
        const selectedText = editor.document.getText(selection);
        const language = editor.document.languageId;
        // Get API key
        const apiKey = await (0, utils_1.getGeminiApiKey)();
        if (!apiKey)
            return;
        // Show progress
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'AI Explaining Code…' }, async (progress) => {
            try {
                // Call backend for explanation
                const response = await fetch('http://localhost:8000/explain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: selectedText, language, apiKey })
                });
                if (!response.ok)
                    throw new Error('Failed to get explanation');
                const result = await response.json();
                const explanation = result.explanation || 'No explanation available.';
                // Simple markdown to HTML converter
                function markdownToHtml(md) {
                    return md
                        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>');
                }
                const formattedExplanation = markdownToHtml(explanation);
                // Show in webview panel
                const panel = vscode.window.createWebviewPanel('codeExplanation', 'AI Code Explanation', vscode.ViewColumn.Beside, { enableScripts: true });
                panel.webview.html = `
                <html>
                <body style="font-family: var(--vscode-font-family); padding: 16px;">
                  <h2>AI Code Explanation</h2>
                  <h3>Selected Code:</h3>
                  <pre style="background: var(--vscode-editor-background); padding: 8px; border: 1px solid var(--vscode-panel-border);"><code>${selectedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                  <h3>Explanation:</h3>
                  <div style="line-height: 1.6;"><p>${formattedExplanation}</p></div>
                </body>
                </html>
              `;
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to explain code: ' + error.message);
            }
        });
    }));
    // -------------------- EXPORT REPORT COMMAND --------------------
    context.subscriptions.push(vscode.commands.registerCommand('aireview-mentor.exportReport', async () => {
        if (issuesData.length === 0) {
            vscode.window.showWarningMessage('No review data available. Run AI Review first.');
            return;
        }
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder)
            return;
        // Generate HTML report
        const critical = issuesData.filter(i => i.severity.toLowerCase() === 'critical');
        const major = issuesData.filter(i => i.severity.toLowerCase() === 'major');
        const minor = issuesData.filter(i => i.severity.toLowerCase() === 'minor');
        const reportHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>AI Code Review Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background: #f0f0f0; padding: 20px; border-radius: 8px; }
              .summary { display: flex; gap: 20px; margin: 20px 0; }
              .metric { background: #e8f4fd; padding: 15px; border-radius: 8px; text-align: center; }
              .critical { background: #ffebee; }
              .major { background: #fff3e0; }
              .minor { background: #e8f5e8; }
              .issues { margin-top: 30px; }
              .issue { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
              .issue.critical { border-left: 5px solid #d32f2f; }
              .issue.major { border-left: 5px solid #f57c00; }
              .issue.minor { border-left: 5px solid #388e3c; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>AI Code Review Report</h1>
              <p>Generated on ${new Date().toLocaleString()}</p>
              <p>Project: ${folder.name}</p>
            </div>

            <div class="summary">
              <div class="metric">
                <h3>Total Issues</h3>
                <div style="font-size: 2em; font-weight: bold;">${issuesData.length}</div>
              </div>
              <div class="metric critical">
                <h3>Critical</h3>
                <div style="font-size: 2em; font-weight: bold;">${critical.length}</div>
              </div>
              <div class="metric major">
                <h3>Major</h3>
                <div style="font-size: 2em; font-weight: bold;">${major.length}</div>
              </div>
              <div class="metric minor">
                <h3>Minor</h3>
                <div style="font-size: 2em; font-weight: bold;">${minor.length}</div>
              </div>
            </div>

            <div class="issues">
              <h2>Issues Details</h2>
              ${issuesData.map(issue => `
                <div class="issue ${issue.severity.toLowerCase()}">
                  <h3>${issue.file.split('/').pop()}:${issue.line_start} - ${issue.type}</h3>
                  <p><strong>Severity:</strong> ${issue.severity}</p>
                  <p><strong>Description:</strong> ${issue.description}</p>
                  <p><strong>Comment:</strong> ${issue.comment}</p>
                </div>
              `).join('')}
            </div>
          </body>
          </html>
        `;
        // Save to file
        const reportPath = path.join(folder.uri.fsPath, 'AI_Review_Report.html');
        fs.writeFileSync(reportPath, reportHtml, 'utf-8');
        // Open in browser
        const uri = vscode.Uri.file(reportPath);
        vscode.env.openExternal(uri);
        vscode.window.showInformationMessage('Review report exported and opened in browser.');
    }));
    // -------------------- MAIN COMMAND --------------------
    const reviewCommand = vscode.commands.registerCommand('aireview-mentor.review-mentor', async () => {
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
            }
            catch {
                // Ignore binary files
            }
        });
        // -------------------- STEP 2: GEMINI API KEY --------------------
        const apiKey = await (0, utils_1.getGeminiApiKey)();
        if (!apiKey)
            return;
        const summaryJsonPath = path.join(root, 'CODE_REVIEW_SUMMARY.json');
        const alreadyReviewed = fs.existsSync(summaryJsonPath);
        const beforeTimestamps = (0, utils_1.captureTimestamps)(root);
        // -------------------- STEP 3: RUN GEMINI --------------------
        if (!alreadyReviewed) {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'AI Reviewing…' }, async () => {
                await (0, utils_1.runReview)(root, apiKey);
            });
        }
        else {
            vscode.window.showInformationMessage('Using existing AI review summary.');
        }
        // -------------------- STEP 4: POST-PROCESS --------------------
        const afterTimestamps = (0, utils_1.captureTimestamps)(root);
        const modifiedFiles = (0, utils_1.detectModifiedFiles)(beforeTimestamps, afterTimestamps);
        (0, utils_1.highlightModifiedFiles)(modifiedFiles);
        // -------------------- STEP 5: READ JSON SUMMARY --------------------
        const summaryJson = (0, utils_1.readSummaryJson)(root);
        let issueFiles = new Set();
        if (summaryJson && Array.isArray(summaryJson.issues)) {
            (0, diagnostics_1.applyDiagnostics)(diagnostics, summaryJson.issues);
            (0, summaryPanel_1.showSmartSummary)(summaryJson, modifiedFiles);
            issueFiles = new Set(summaryJson.issues.map((i) => i.file).filter((f) => f));
            issuesData = summaryJson.issues;
            refreshIssues();
            statusBarItem.text = `$(check) ${issuesData.length} Issues`;
            statusBarItem.tooltip = `AI Review Complete: ${issuesData.length} issues found`;
        }
        else {
            vscode.window.showWarningMessage('AI review summary not found or invalid JSON.');
        }
        // -------------------- STEP 6: DIFF + ACCEPT/REJECT PANEL --------------------
        for (const file of issueFiles) {
            if (!file)
                continue;
            const original = originalFileContents.get(file);
            if (!original)
                continue;
            const modified = fs.readFileSync(file, 'utf-8');
            proposedFixes.set(file, modified);
            const fileIssues = summaryJson.issues.filter((i) => i.file === file);
            // Show diff preview (non-blocking)
            await (0, diffPreview_1.showDiffPreview)(file, original, modified);
            // Show Accept/Reject panel
            (0, acceptRejectPanel_1.showAcceptRejectPanel)(file, original, modified, fileIssues, () => fs.writeFileSync(file, modified), // Accept
            () => fs.writeFileSync(file, original) // Reject
            );
        }
    });
    context.subscriptions.push(reviewCommand, diagnostics);
}
// -------------------- DEACTIVATE --------------------
function deactivate() { }
//# sourceMappingURL=extension.js.map