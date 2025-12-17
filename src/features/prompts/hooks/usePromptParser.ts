import { useCallback } from "react";
import { useLorebookContext } from "@/features/lorebook/context/LorebookContext";
import type { ParsedPrompt, PromptParserConfig } from "@/types/story";
import { createPromptParser } from "../services/promptParser";

/**
 * Hook that provides prompt parsing with automatic lorebook context injection.
 * Eliminates the need to pass entries manually through component layers.
 */
export function usePromptParser() {
    const { entries } = useLorebookContext();

    const parsePrompt = useCallback(
        async (config: PromptParserConfig): Promise<ParsedPrompt> => {
            const parser = createPromptParser({ entries });
            return parser.parse(config);
        },
        [entries]
    );

    return { parsePrompt };
}
