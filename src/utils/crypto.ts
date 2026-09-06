/** getRandomValues-based v4 — works in insecure contexts where crypto.randomUUID is absent. */
export const uuidV4Fallback = (getRandomValues: (bytes: Uint8Array) => Uint8Array): string => {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const randomUUID = (): string => {
    // Try native implementations first
    if (typeof window !== "undefined" && window.crypto?.randomUUID) 
        return window.crypto.randomUUID();
    
    if (typeof crypto !== "undefined" && crypto.randomUUID) 
        return crypto.randomUUID();
    

    // Fallback: available in both secure and insecure contexts
    if (typeof window !== "undefined" && window.crypto?.getRandomValues)
        return uuidV4Fallback(bytes => window.crypto.getRandomValues(bytes));

    // Last resort: Math.random (not cryptographically secure, but works)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
