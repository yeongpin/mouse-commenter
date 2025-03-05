import * as vscode from 'vscode';
import { addAIComments } from './commentService';
import { loadConfig, registerConfigChangeListener } from './configService';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Commenter is now active');

    // Load initial configuration
    let config = loadConfig(context);

    // Register configuration change listener
    registerConfigChangeListener(context);

    // Register the command to add comments
    let addCommentsCommand = vscode.commands.registerCommand('mouse-commenter.addComments', async () => {
        // Get the latest configuration before running the command
        config = loadConfig(context);

        // Get the active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        // Show language selection dropdown
        const languageOptions = [
            { label: 'English', value: 'english' },
            { label: '简体中文', value: 'simplifiedChinese' },
            { label: '繁體中文', value: 'traditionalChinese' }
        ];

        const selectedLanguage = await vscode.window.showQuickPick(
            languageOptions.map(option => option.label),
            { placeHolder: 'Select comment language' }
        );

        if (!selectedLanguage) {
            return; // User cancelled the selection
        }

        const languageValue = languageOptions.find(option => option.label === selectedLanguage)?.value || 'english';
        
        // Get the document text
        const document = editor.document;
        const text = document.getText();
        const fileName = document.fileName.split('/').pop() || 'untitled';
        const fileExtension = document.languageId;

        // Create a temporary document to show the commented code
        const tempDoc = await vscode.workspace.openTextDocument({
            language: fileExtension
        });
        
        const tempEditor = await vscode.window.showTextDocument(tempDoc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: false
        });

        // Start the AI comment process
        try {
            await addAIComments(text, fileExtension, languageValue, tempEditor, config);
        } catch (error) {
            vscode.window.showErrorMessage(`Error adding comments: ${error}`);
        }
    });

    // Register command to configure AI provider
    let configureAICommand = vscode.commands.registerCommand('mouse-commenter.configureAI', async () => {
        // Open the settings page, focusing on the extension settings
        vscode.commands.executeCommand('workbench.action.openSettings', 'mouse-commenter');
    });

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'untitled' }, // Only enable in temporary files
            new ReexplainCodeActionProvider(),
            {
                providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite]
            }
        )
    );

    context.subscriptions.push(addCommentsCommand, configureAICommand);
}

export function deactivate() {}

class ReexplainCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeAction[]> {
        // Only provide actions when there is selected text
        if (range.isEmpty) {
            return [];
        }
        
        // Only provide actions in temporary files
        if (document.uri.scheme !== 'untitled' || 
            !document.getText().includes('// Adding AI comments to')) {
            return [];
        }
        
        const reexplainAction = new vscode.CodeAction(
            'Reexplain selected code',
            vscode.CodeActionKind.RefactorRewrite
        );
        reexplainAction.command = {
            command: 'mouse-commenter.reexplainSelected',
            title: 'Reexplain selected code'
        };
        
        return [reexplainAction];
    }
} 