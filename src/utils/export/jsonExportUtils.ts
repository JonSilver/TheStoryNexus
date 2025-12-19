/**
 * Generic JSON export utility for downloading data as JSON files.
 * Reduces duplication across features that need export functionality.
 */

interface ExportData {
    version: string;
    type: string;
    exportedAt?: string;
    [key: string]: unknown;
}

/**
 * Downloads data as a JSON file using a blob URL.
 *
 * @param data - The data object to export
 * @param filename - Name of the downloaded file
 *
 * @example
 * ```ts
 * downloadJSON({
 *   version: '1.0',
 *   type: 'prompts',
 *   prompts: myPrompts
 * }, 'prompts-export-2025-01-15.json');
 * ```
 */
export const downloadJSON = (data: ExportData, filename: string): void => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    // Temporarily add to DOM for Firefox compatibility
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the blob URL
    URL.revokeObjectURL(url);
};

/**
 * Downloads data as a JSON file using a data URI.
 * Alternative method that doesn't require blob URLs.
 *
 * @param data - The data object to export
 * @param filename - Name of the downloaded file
 *
 * @example
 * ```ts
 * downloadJSONDataURI({
 *   version: '1.0',
 *   type: 'prompts',
 *   prompts: myPrompts
 * }, 'prompts-export-2025-01-15.json');
 * ```
 */
export const downloadJSONDataURI = (data: ExportData, filename: string): void => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

    const a = document.createElement("a");
    a.href = dataUri;
    a.download = filename;
    a.click();
};

/**
 * Generates a timestamped filename for exports.
 *
 * @param prefix - The prefix for the filename (e.g., 'prompts-export', 'lorebook')
 * @param extension - File extension (defaults to 'json')
 * @returns Filename with timestamp
 *
 * @example
 * ```ts
 * generateExportFilename('prompts-export'); // 'prompts-export-2025-01-15.json'
 * generateExportFilename('lorebook', 'txt'); // 'lorebook-2025-01-15.txt'
 * ```
 */
export const generateExportFilename = (prefix: string, extension = "json"): string => {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${prefix}-${timestamp}.${extension}`;
};
