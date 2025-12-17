/**
 * Normalizes a string for comparison by trimming whitespace and converting to lowercase
 */
export const normalizeString = (str: string): string => str.toLowerCase().trim();

/**
 * Compares two strings case-insensitively after normalization
 */
export const stringEquals = (a: string, b: string): boolean => normalizeString(a) === normalizeString(b);
