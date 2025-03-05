import * as vscode from 'vscode';
import axios from 'axios';
import { AIConfig } from '../configService';
import { cleanMarkdown } from '../markdownService';

// Ollama API service for generating comments
export async function generateCommentsWithOllama(
    code: string,
    language: string,
    commentLanguage: string,
    config: AIConfig,
    progressCallback: (text: string, isComment: boolean) => Promise<void>
): Promise<void> {
    // Prepare the prompt with language parameter
    const prompt = config.promptTemplate || `You are an expert code commentator. Analyze the following ${language} code and provide a detailed explanation in ${commentLanguage}.\n\nFocus on the purpose, functionality, and important patterns or techniques used. Only add comments inside the code block while preserving the correct commenting style for each language.\n\nRules:\n- For HTML, use \`<!-- -->\` comments.\n- For JavaScript inside <script> tags, use \`//\` for single-line comments and \`/* */\` for multi-line comments.\n- For CSS, use \`/* */\` comments.\n- Do not add explanations outside of the code block.\n- Do not add comments outside of the code block.\n- Do not add any note outside of the code block.\n- Ensure comments do not interfere with code execution.\n\n\`\`\`${language}\n${code}\n\`\`\``;

    try {
        // Log the request details for debugging
        const endpoint = config.endpoint || 'http://localhost:11434/api/generate';
        const model = config.model || 'codellama';
        
        console.log(`Sending request to Ollama API at: ${endpoint}`);
        console.log(`Using model: ${model}`);
        
        // Show the prompt being used
        if (config.onlyCodeAndComments !== true) {
            await progressCallback(`// Using Ollama with model ${model}\n`, true);
        }
        
        try {
            // Real API call
            const response = await axios.post(
                endpoint,
                {
                    model: model,
                    prompt: prompt,
                    stream: true
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream'
                }
            );
            
            // Handle the streaming response
            let codeBlockStarted = false;
            let insideCodeBlock = false;
            let languageLineSkipped = false;
            let buffer = ""; // Buffer to handle inline code that might be split across chunks
            let finalOutput = ""; // Store the complete output
            let commentingComplete = false; // Ensure AI comments are only marked once
                    
            response.data.on('data', async (chunk: Buffer) => {
                try {
                    const text = chunk.toString();
                    buffer += text;
                    
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || "";
                    
                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            if (json.response) {
                                let response = json.response;
                            
                                // If a code block is detected, mark the comment as complete and stop
                                if (response.includes("```")) {
                                    if (!codeBlockStarted) {
                                        codeBlockStarted = true;
                                        insideCodeBlock = true;
                                        continue;
                                    } else {
                                        insideCodeBlock = false;
                                    
                                        if (!commentingComplete) {
                                            commentingComplete = true;
                                            if (config.onlyCodeAndComments !== true) {
                                                await progressCallback("\n// AI commenting complete!\n", true);
                                            }
                                        }
                                        return; // Stop further processing directly
                                    }
                                }
                                
                                // Process language identifier line
                                if (insideCodeBlock && !languageLineSkipped) {
                                    if (response.trim().match(/^[a-zA-Z0-9_+-]+$/)) {
                                        languageLineSkipped = true;
                                        continue;
                                    }
                                    languageLineSkipped = true;
                                }
                                
                                // Process response content
                                let processedResponse = response;
                                if (!insideCodeBlock) {
                                    processedResponse = cleanMarkdown(response);
                                }
                                
                                // Add to final output and send to callback
                                finalOutput += processedResponse;
                                await progressCallback(processedResponse, true);
                            }
                        } catch (e) {
                            console.error('Error parsing JSON from Ollama response:', e);
                        }
                    }
                } catch (e) {
                    console.error('Error processing Ollama response chunk:', e);
                }
            });


            
            response.data.on('end', async () => {
                // First handle any remaining buffer
                if (buffer.trim()) {
                    try {
                        const json = JSON.parse(buffer);
                        if (json.response) {
                            let processedResponse = json.response;
            
                            // Always clean markdown for any response
                            if (!insideCodeBlock) {
                                processedResponse = cleanMarkdown(processedResponse);
                            }
            
                            if (insideCodeBlock || !codeBlockStarted) {
                                await progressCallback(processedResponse, true);
                            }
                        }
                    } catch (e) {
                        console.error('Error processing final buffer:', e);
                    }
                }
            
                // Remove any leftover ` ``` `
                finalOutput = finalOutput.replace(/```/g, "").trim();
            
                // Ensure only marking once AI comment complete
                if (!commentingComplete) {
                    if (config.onlyCodeAndComments !== true) {
                        await progressCallback("\n// AI commenting complete!\n", true);
                    }
                    commentingComplete = true;
                }
            });
            

            
            return;
        } catch (apiError) {
            console.error('Error calling Ollama API directly:', apiError);
            // Fall back to simulation if API call fails
            await progressCallback(`// Error calling Ollama API directly. Falling back to simulation.\n`, true);
        }
                
    } catch (error) {
        console.error('Error calling Ollama API:', error);
        
        // Provide more detailed error information
        let errorMessage = 'Failed to generate comments with Ollama';
        if (axios.isAxiosError(error)) {
            if (error.response) {
                errorMessage += `: Server responded with status ${error.response.status}`;
                console.error('Response data:', error.response.data);
            } else if (error.request) {
                errorMessage += ': No response received from server';
            } else {
                errorMessage += `: ${error.message}`;
            }
        }
        
        // Fall back to simulation for development/testing
        await progressCallback(`// Error connecting to Ollama API: ${errorMessage}\n// Falling back to simulated response\n`, true);
    }
}


