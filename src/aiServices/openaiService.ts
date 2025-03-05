import * as vscode from 'vscode';
import axios from 'axios';
import { AIConfig } from '../configService';
import { cleanMarkdown } from '../markdownService';

// OpenAI API service for generating comments
export async function generateCommentsWithOpenAI(
    code: string,
    language: string,
    commentLanguage: string,
    config: AIConfig,
    progressCallback: (text: string, isComment: boolean) => Promise<void>
): Promise<void> {
    // Prepare the prompt with language parameter
    const prompt = config.promptTemplate || `You are an expert code commentator. Analyze the following ${language} code and provide a detailed explanation in ${commentLanguage}.\n\nFocus on the purpose, functionality, and important patterns or techniques used. Only add comments inside the code block while preserving the correct commenting style for each language.\n\nRules:\n- For HTML, use \`<!-- -->\` comments.\n- For JavaScript inside <script> tags, use \`//\` for single-line comments and \`/* */\` for multi-line comments.\n- Do not add explanations outside of the code block.\n- Do not add comments outside of the code block.\n- Do not add any note outside of the code block.\n- Ensure comments do not interfere with code execution.\n\n\`\`\`${language}\n${code}\n\`\`\``;

    try {
        // Log the request details for debugging
        const model = config.model || 'gpt-3.5-turbo';
        console.log(`Using OpenAI model: ${model}`);
        
        // Show the model being used
        if (config.onlyCodeAndComments !== true) {
            await progressCallback(`// Using OpenAI with model ${model}\n`, true);
        }

        try {
            // Validate API key
            const apiKey = config.apiKey;
            if (!apiKey) {
                throw new Error('OpenAI API key is not configured');
            }

            // Make the API call with streaming
            const response = await axios.post(
                `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`,
                {
                    model: model,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    stream: true
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    responseType: 'stream'
                }
            );

            // Handle the streaming response
            let codeBlockStarted = false;
            let insideCodeBlock = false;
            let languageLineSkipped = false;
            let buffer = "";
            let finalOutput = "";
            let commentingComplete = false;

            response.data.on('data', async (chunk: Buffer) => {
                try {
                    const text = chunk.toString();
                    const lines = text.split('\n');
            
                    for (const line of lines) {
                        if (line.trim().startsWith('data: ')) {
                            const jsonString = line.replace('data: ', '').trim();
                            if (jsonString === '[DONE]') continue;
            
                            try {
                                const json = JSON.parse(jsonString);
                                const content = json.choices[0]?.delta?.content || '';
            
                                // 偵測代碼塊標記
                                if (content.includes("```")) {
                                    if (!codeBlockStarted) {
                                        codeBlockStarted = true;
                                        insideCodeBlock = true;
                                        continue;
                                    } else {
                                        insideCodeBlock = false;
            
                                        // 清除所有 ` ``` ` 並標記完成
                                        if (!commentingComplete) {
                                            commentingComplete = true;
                                            finalOutput = finalOutput.replace(/```/g, "").trim();
                                            if (config.onlyCodeAndComments !== true) {
                                                await progressCallback("\n// AI commenting complete!\n", true);
                                            }
                                        }
                                        return;
                                    }
                                }
            
                                // 檢測語言標識行
                                if (insideCodeBlock && !languageLineSkipped) {
                                    if (content.trim().match(/^[a-zA-Z0-9_+-]+$/)) {
                                        languageLineSkipped = true;
                                        continue;
                                    }
                                    languageLineSkipped = true;
                                }
            
                                // 清理內容
                                let processedContent = content;
                                if (!insideCodeBlock) {
                                    processedContent = cleanMarkdown(content);
                                }
            
                                finalOutput += processedContent;
                                await progressCallback(processedContent, true);
                            } catch (e) {
                                if (jsonString !== '[DONE]') {
                                    console.error('Error parsing JSON from OpenAI response:', e);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error processing OpenAI response chunk:', e);
                }
            });
            

            response.data.on('end', async () => {
                // 清理 buffer 內容
                if (buffer.trim()) {
                    let processedBuffer = insideCodeBlock ? buffer : cleanMarkdown(buffer);
                    await progressCallback(processedBuffer, true);
                }
            
                // 清除所有遺留的 ` ``` `
                finalOutput = finalOutput.replace(/```/g, "").trim();
            
                // 確保 `// AI commenting complete!` 只標記一次
                if (!commentingComplete) {
                    if (config.onlyCodeAndComments !== true) {
                        await progressCallback("\n// AI commenting complete!\n", true);
                    }
                    commentingComplete = true;
                }
            });
            

        } catch (apiError) {
            console.error('Error calling OpenAI API directly:', apiError);
            await progressCallback(`// Error calling OpenAI API directly: ${apiError}\n`, true);
            throw apiError;
        }

    } catch (error) {
        console.error('Error in OpenAI service:', error);
        
        let errorMessage = 'Failed to generate comments with OpenAI';
        if (error instanceof Error) {
            errorMessage += `: ${error.message}`;
        }
        
        await progressCallback(`// Error with OpenAI service: ${errorMessage}\n`, true);
        throw error;
    }
}

// Helper function to get language text
function getLanguageText(commentLanguage: string): string {
    switch (commentLanguage) {
        case 'simplifiedChinese': return "简体中文";
        case 'traditionalChinese': return "繁體中文";
        default: return "English";
    }
}


