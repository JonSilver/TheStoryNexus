// Default import: lodash is CJS, so named imports break under native ESM
// (the server imports this module via tsx); the default import works in both
import lodash from "lodash";

const { words } = lodash;

/**
 * Count the number of words in a text string.
 * Uses lodash.words for robust word boundary detection that handles:
 * - Unicode characters
 * - Punctuation
 * - Multiple consecutive spaces
 * - Newlines and special whitespace characters
 *
 * @param text - The text to count words in
 * @returns The number of words, or 0 if text is empty/null
 *
 * @example
 * ```ts
 * countWords('Hello world')  // 2
 * countWords('  ')  // 0
 * countWords('')  // 0
 * countWords('Hello,  world!')  // 2
 * ```
 */
export const countWords = (text: string): number => {
    if (!text || !text.trim()) return 0;
    return words(text).length;
};
