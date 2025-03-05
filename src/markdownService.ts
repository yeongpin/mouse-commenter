// Clean Markdown format, remove code blocks and inline code markers
export function cleanMarkdown(text: string): string {
    let cleaned = text.trim();

    // Try to extract all code blocks
    const codeBlockRegex = /```(?:[\w-]*\n)?([\s\S]*?)```/g;
    const matches = getAllMatches(cleaned, codeBlockRegex);
    
    if (matches.length > 0) {
        // Merge all code block contents
        cleaned = matches.map(match => match[1].trim()).join("\n");
    } else {
        // If no complete code block is matched, still remove all ``` symbols
        cleaned = cleaned.replace(/```/g, "");
    }

    // Remove inline code markers
    cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

    // Ensure no extra Markdown leftovers
    return cleaned.trim();
}


// Alternative implementation of matchAll, compatible with older JavaScript
export function getAllMatches(str: string, regex: RegExp): RegExpExecArray[] {
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    const clonedRegex = new RegExp(regex.source, regex.flags);
    
    while ((match = clonedRegex.exec(str)) !== null) {
        matches.push(match);
        if (!clonedRegex.global) break;
    }
    
    return matches;
} 