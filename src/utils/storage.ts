/**
 * The browser's localStorage, never throwing: private mode, blocked site data
 * or a full quota read as "nothing kept" and writes report refusal. Callers
 * decide what a refusal means for the writer.
 */
const attempt = <T>(read: () => T, fallback: T): T => {
    try {
        return read();
    } catch {
        return fallback;
    }
};

export const storage = {
    get: (key: string): string | null => attempt(() => localStorage.getItem(key), null),
    /** Parsed JSON, or undefined when absent or unreadable — shape-check before trusting it. */
    getJSON: (key: string): unknown =>
        attempt(() => JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined, undefined),
    /** False when the browser refused to keep it. */
    set: (key: string, value: string): boolean =>
        attempt(() => {
            localStorage.setItem(key, value);
            return true;
        }, false),
    setJSON: (key: string, value: unknown): boolean => storage.set(key, JSON.stringify(value)),
    remove: (key: string): void => attempt(() => localStorage.removeItem(key), undefined),
    keysStartingWith: (prefix: string): string[] =>
        attempt(
            () =>
                Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
                    (key): key is string => !!key?.startsWith(prefix)
                ),
            []
        )
};
