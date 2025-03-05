import * as vscode from 'vscode';
import { generateComments } from './aiService';
import { AIConfig, getCurrentConfig } from './configService';

// Global variable to track and clear decorations
let commentDecorationType: vscode.TextEditorDecorationType | undefined;

// Function to add AI comments to code
export async function addAIComments(
    code: string,
    language: string,
    commentLanguage: string,
    editor: vscode.TextEditor,
    config: AIConfig
): Promise<void> {
    try {
        // Clear previous decorations
        if (commentDecorationType) {
            commentDecorationType.dispose();
            commentDecorationType = undefined;
        }
        
        // Create new decoration type
        commentDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(0, 255, 0, 0.2)',
            isWholeLine: true
        });
        
        // Add a starting message
        if (config.onlyCodeAndComments !== true) {
            await appendToEditor(editor, "// Author ： yeongpin \n// Github : https://github.com/yeongpin \n\n");
        }
        
        // Call the AI service to generate comments
        await generateComments(
            code,
            language,
            commentLanguage,
            config,
            async (text: string, isComment: boolean) => {
                await appendToEditor(editor, text, isComment);
            }
        );
        
    } catch (error) {
        console.error('Error generating comments:', error);
        vscode.window.showErrorMessage(`Failed to generate comments: ${error}`);
        
        // Also clear decoration when an error occurs
        if (commentDecorationType) {
            commentDecorationType.dispose();
            commentDecorationType = undefined;
        }
    }
}

// Function to append text to the editor with optional highlighting
async function appendToEditor(
    editor: vscode.TextEditor,
    text: string,
    highlight: boolean = false
): Promise<void> {
    const document = editor.document;
    const lastLine = document.lineAt(document.lineCount - 1);
    const position = new vscode.Position(lastLine.lineNumber, lastLine.range.end.character);
    
    // Apply the edit
    await editor.edit(editBuilder => {
        editBuilder.insert(position, text);
    });
    
    // Check if there is a completion message
    if (text.includes("AI commenting complete")) {
        const config = getCurrentConfig();
        
        // Only show completion message if onlyCodeAndComments is not true
        if (config.onlyCodeAndComments !== true && commentDecorationType) {
            // If it's a completion message, clear the decoration after a short delay
            setTimeout(() => {
                if (commentDecorationType) {
                    commentDecorationType.dispose();
                    commentDecorationType = undefined;
                }
            }, 1000);
        }
        return;
    }
    
    // Highlight all other content (whether it's a comment or not)
    if (commentDecorationType) {
        const endPosition = editor.document.positionAt(
            editor.document.getText().length
        );
        const startPosition = new vscode.Position(0, 0); // Highlight from the start of the document
        
        // Apply the decoration to the entire document
        editor.setDecorations(commentDecorationType, [
            new vscode.Range(startPosition, endPosition)
        ]);
    }
}
