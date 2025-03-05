import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// Interface for AI configuration
export interface AIConfig {
    type: string;
    service: string;
    model: string;
    apiKey?: string;
    endpoint?: string;
    baseUrl?: string;
    promptTemplate?: string;
    onlyCodeAndComments?: boolean;
}

// Store the current configuration
let currentConfig: AIConfig | null = null;

// Function to load configuration
export function loadConfig(context: vscode.ExtensionContext): AIConfig {
    // Default configuration
    const defaultConfig: AIConfig = {
        type: 'ollama',
        service: 'ollama',
        model: 'codellama',
        endpoint: 'http://localhost:11434/api/generate',
        baseUrl: 'https://api.openai.com/v1',
        promptTemplate: 'You are an expert code commentator. Analyze the following ${language} code and provide a detailed explanation in ${commentLanguage}. Focus on the purpose, functionality, and important patterns or techniques used. Only add comments inside the code block while preserving the correct commenting style for each language. For HTML, use `<!-- -->` comments. For JavaScript inside <script> tags, use `//` for single-line comments and `/* */` for multi-line comments , if in css use /* */ comments. Do not add explanations outside of the code block ， and do not add comments outside of the code block , and do not add any note outside of the code block . Ensure comments do not interfere with code execution.\n\n${code}',
        onlyCodeAndComments: false
    };
    
    try {
        // Get configuration from VSCode settings
        const config = vscode.workspace.getConfiguration('mouse-commenter');
        const aiType = config.get<string>('aiType') || defaultConfig.type;
        const apiKey = config.get<string>('apiKey') || '';
        
        // Try to load config.ini if it exists
        const configPath = path.join(context.extensionPath, 'config.ini');
        if (fs.existsSync(configPath)) {
            const iniConfig = ini.parse(fs.readFileSync(configPath, 'utf-8'));
            
            // Merge configurations with priority: VSCode settings > config.ini > defaults
            currentConfig = {
                type: aiType || iniConfig.ai?.type || defaultConfig.type,
                service: aiType as 'ollama' | 'openai',
                model: config.get<string>('model') || 
                       (aiType === 'openai' ? iniConfig.openai?.model : iniConfig.ollama?.model) || 
                       defaultConfig.model,
                apiKey: apiKey || iniConfig.openai?.api_key || '',
                endpoint: config.get<string>('endpoint') || iniConfig.ollama?.endpoint || defaultConfig.endpoint,
                baseUrl: config.get<string>('baseUrl') || iniConfig.openai?.base_url || defaultConfig.baseUrl,
                onlyCodeAndComments: config.get<boolean>('onlyCodeAndComments') || defaultConfig.onlyCodeAndComments
            };
            return currentConfig;
        }
        
        // If no config.ini, use VSCode settings
        currentConfig = {
            type: aiType,
            service: aiType as 'ollama' | 'openai',
            model: config.get<string>('model') || defaultConfig.model,
            apiKey: apiKey,
            endpoint: config.get<string>('endpoint') || defaultConfig.endpoint,
            baseUrl: config.get<string>('baseUrl') || defaultConfig.baseUrl,
            onlyCodeAndComments: config.get<boolean>('onlyCodeAndComments') || defaultConfig.onlyCodeAndComments
        };
        return currentConfig;
    } catch (error) {
        console.error('Error loading configuration:', error);
        currentConfig = defaultConfig;
        return defaultConfig;
    }
}

// Function to get current configuration
export function getCurrentConfig(): AIConfig {
    if (!currentConfig) {
        throw new Error('Configuration not initialized');
    }
    return currentConfig;
}

// Function to save configuration
export function saveConfig(config: AIConfig, context: vscode.ExtensionContext): void {
    try {
        const configPath = path.join(context.extensionPath, 'config.ini');
        const iniConfig: any = {
            ai: {
                type: config.type,
                model: config.model
            },
            openai: {
                api_key: config.apiKey || '',
                model: config.type === 'openai' ? config.model : 'gpt-4',
                base_url: config.baseUrl || 'https://api.openai.com/v1'
            },
            ollama: {
                endpoint: config.endpoint || 'http://localhost:11434/api/generate',
                model: config.type === 'ollama' ? config.model : 'codellama'
            }
        };
        
        fs.writeFileSync(configPath, ini.stringify(iniConfig));
        
        // Also update VSCode settings
        const vsConfig = vscode.workspace.getConfiguration('mouse-commenter');
        vsConfig.update('aiType', config.type, vscode.ConfigurationTarget.Global);
        vsConfig.update('model', config.model, vscode.ConfigurationTarget.Global);
        
        if (config.type === 'openai') {
            vsConfig.update('apiKey', config.apiKey, vscode.ConfigurationTarget.Global);
            vsConfig.update('baseUrl', config.baseUrl, vscode.ConfigurationTarget.Global);
        } else if (config.type === 'ollama') {
            vsConfig.update('endpoint', config.endpoint, vscode.ConfigurationTarget.Global);
        }

        vsConfig.update('onlyCodeAndComments', config.onlyCodeAndComments, vscode.ConfigurationTarget.Global);

        // Update current configuration
        currentConfig = config;
    } catch (error) {
        console.error('Error saving configuration:', error);
        vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
    }
}

// Function to register configuration change listener
export function registerConfigChangeListener(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async event => {
            if (event.affectsConfiguration('mouse-commenter')) {
                const newConfig = loadConfig(context);
                
                // Show notification about the configuration change
                const configType = newConfig.type === 'ollama' ? 'Ollama' : 'OpenAI';
                const message = `${configType} configuration updated`;
                const details = `View Details`;
                
                const selection = await vscode.window.showInformationMessage(
                    message,
                    { modal: false, detail: `Model: ${newConfig.model}\nEndpoint: ${newConfig.type === 'ollama' ? newConfig.endpoint : newConfig.baseUrl}` },
                    details
                );
                
                if (selection === details) {
                    // Show full configuration details
                    vscode.window.showInformationMessage(
                        `Full Configuration:\n` +
                        `Type: ${configType}\n` +
                        `Model: ${newConfig.model}\n` +
                        `Endpoint: ${newConfig.type === 'ollama' ? newConfig.endpoint : newConfig.baseUrl}`,
                        { modal: true }
                    );
                }
            }
        })
    );
} 