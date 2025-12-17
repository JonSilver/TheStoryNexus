import { z } from "zod";
import { parseJSON } from "@/schemas/entities";
import { logger } from "@/utils/logger";

/**
 * Lexical editor state structure
 */
interface LexicalNode {
    type: string;
    text?: string;
    children?: LexicalNode[];
    tag?: string;
    version?: number;
    [key: string]: unknown;
}

const lexicalNodeSchema: z.ZodType<LexicalNode> = z.lazy(() =>
    z
        .object({
            type: z.string(),
            text: z.string().optional(),
            children: z.array(lexicalNodeSchema).optional(),
            tag: z.string().optional(),
            version: z.number().optional()
        })
        .passthrough()
);

const lexicalEditorStateSchema = z
    .object({
        root: z
            .object({
                children: z.array(lexicalNodeSchema).optional()
            })
            .passthrough()
            .optional()
    })
    .passthrough();

interface LexicalTextExtractionOptions {
    /** Spacing to add after paragraphs and headings */
    paragraphSpacing: "\n" | "\n\n";
    /** Node types to exclude from text extraction */
    excludeNodeTypes?: string[];
    /** Whether to cleanup multiple consecutive newlines */
    cleanupMultipleNewlines?: boolean;
}

const defaultOptions: LexicalTextExtractionOptions = {
    paragraphSpacing: "\n",
    excludeNodeTypes: ["scene-beat"],
    cleanupMultipleNewlines: true
};

/**
 * Extracts plain text from Lexical JSON content.
 * Handles text nodes, linebreaks, paragraphs, headings, and custom nodes.
 *
 * @param jsonContent - The Lexical editor state as JSON string
 * @param options - Configuration options for text extraction
 * @returns Plain text representation of the content
 *
 * @example
 * ```ts
 * // Extract with default options (single newline, exclude scene-beats)
 * const text = extractPlainTextFromLexical(editorState);
 *
 * // Extract with double newlines for paragraphs
 * const text = extractPlainTextFromLexical(editorState, {
 *   paragraphSpacing: '\n\n'
 * });
 *
 * // Include scene-beat nodes in extraction
 * const text = extractPlainTextFromLexical(editorState, {
 *   excludeNodeTypes: []
 * });
 * ```
 */
export const extractPlainTextFromLexical = (
    jsonContent: string,
    options: Partial<LexicalTextExtractionOptions> = {}
): string => {
    const opts: LexicalTextExtractionOptions = {
        ...defaultOptions,
        ...options
    };

    const result = parseJSON(lexicalEditorStateSchema, jsonContent);
    if (!result.success) {
        logger.error("Invalid Lexical editor state:", result.error.message);
        return "";
    }

    const editorState = result.data;
    if (!editorState.root?.children) 
        return "";
    

    const extractText = (node: LexicalNode): string => {
        if (!node) return "";

        // Check if this node type should be excluded
        if (opts.excludeNodeTypes?.includes(node.type)) 
            return "";
        

        // Handle text nodes
        if (node.type === "text") 
            return node.text || "";
        

        // Handle linebreak nodes
        if (node.type === "linebreak") 
            return "\n";
        

        // Recursively extract text from children
        const childrenText = Array.isArray(node.children) ? node.children.map(extractText).join("") : "";

        // Add spacing after paragraphs and headings
        const lineBreak = node.type === "paragraph" || node.type === "heading" ? opts.paragraphSpacing : "";

        return childrenText + lineBreak;
    };

    const rawText = editorState.root.children.map(extractText).join("");

    // Cleanup multiple consecutive newlines if configured
    const cleanedText = opts.cleanupMultipleNewlines ? rawText.replace(/\n{3,}/g, "\n\n") : rawText;

    return cleanedText.trim();
};
