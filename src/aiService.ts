import * as vscode from 'vscode';
import { AIConfig } from './configService';
import { generateCommentsWithOpenAI } from './aiServices/openaiService';
import { generateCommentsWithOllama } from './aiServices/ollamaService';

// Main function to generate comments based on the configured AI type
export async function generateComments(
    code: string,
    language: string,
    commentLanguage: string,
    config: AIConfig,
    progressCallback: (text: string, isComment: boolean) => Promise<void>
): Promise<void> {
    try {
        // Choose the appropriate AI service based on configuration
        switch (config.type.toLowerCase()) {
            case 'openai':
                await generateCommentsWithOpenAI(code, language, commentLanguage, config, progressCallback);
                break;
            case 'ollama':
                await generateCommentsWithOllama(code, language, commentLanguage, config, progressCallback);
                break;
            default:
                // Default to Ollama if type is not recognized
                console.log(`AI type "${config.type}" not recognized, defaulting to Ollama`);
                await generateCommentsWithOllama(code, language, commentLanguage, config, progressCallback);
        }
    } catch (error) {
        console.error('Error generating comments:', error);
        throw new Error(`Failed to generate comments: ${error}`);
    }
}
