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
        const before = (0, utils_1.captureTimestamps)(root);
        // -------------------- STEP 3: RUN GEMINI --------------------
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'AI Reviewing…' }, async () => {
            await (0, utils_1.runReview)(root, apiKey);
        });
        // -------------------- STEP 4: POST-PROCESS --------------------
        const after = (0, utils_1.captureTimestamps)(root);
        const modifiedFiles = (0, utils_1.detectModifiedFiles)(before, after);
        (0, utils_1.highlightModifiedFiles)(modifiedFiles);
        // -------------------- STEP 5: READ JSON SUMMARY --------------------
        const summaryJson = (0, utils_1.readSummaryJson)(root);
        if (summaryJson && Array.isArray(summaryJson.issues)) {
            (0, diagnostics_1.applyDiagnostics)(diagnostics, summaryJson.issues);
            (0, summaryPanel_1.showSmartSummary)(summaryJson, modifiedFiles);
        }
        else {
            vscode.window.showWarningMessage('AI review summary not found or invalid JSON.');
        }
        // -------------------- STEP 6: DIFF + ACCEPT/REJECT PANEL --------------------
        for (const file of modifiedFiles) {
            const original = originalFileContents.get(file);
            if (!original)
                continue;
            const modified = fs.readFileSync(file, 'utf-8');
            proposedFixes.set(file, modified);
            // Show diff preview (non-blocking)
            await (0, diffPreview_1.showDiffPreview)(file, original, modified);
            // Show Accept/Reject panel
            (0, acceptRejectPanel_1.showAcceptRejectPanel)(file, () => fs.writeFileSync(file, modified), // Accept
            () => fs.writeFileSync(file, original) // Reject
            );
        }
    });
    context.subscriptions.push(reviewCommand, diagnostics);
}
// -------------------- DEACTIVATE --------------------
function deactivate() { }
//# sourceMappingURL=extension.js.map