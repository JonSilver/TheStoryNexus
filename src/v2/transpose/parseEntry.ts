import type { EntryValue } from "./state";

type Draft = Omit<EntryValue, "category">;

/**
 * A transposed bible entry from whatever a model sent: the JSON array the
 * prompt asks for, a lone object, either wrapped in chat or code fences, or
 * plain "Name: … / Description: …" lines. Models that ignore the format still
 * usually say the right things; null only when there's no name and description
 * to be found at all.
 */
const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(s => s.trim()) : [];

const fromObject = (value: unknown): Draft | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const description = typeof record.description === "string" ? record.description.trim() : "";
    if (!name || !description) return null;
    return { name, description, tags: strings(record.tags ?? record.aliases).filter(Boolean) };
};

const jsonFrom = (text: string, open: string, close: string): unknown => {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start < 0 || end <= start) return undefined;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return undefined;
    }
};

const LABELLED = /^\s*[*_#>\-\s]*(name|description|also called|aliases|tags)\s*[*_]*\s*[:：]\s*[*_]*\s*(.*)$/i;

const fromLines = (text: string): Draft | null => {
    const fields: Record<string, string[]> = {};
    const current = { key: "" };
    for (const line of text.split("\n")) {
        const match = LABELLED.exec(line);
        if (match) {
            current.key = match[1].toLowerCase();
            fields[current.key] = [match[2].trim()];
        } else if (current.key === "description" && line.trim()) fields.description.push(line.trim());
    }
    const name = (fields.name?.[0] ?? "").replace(/[*_]+$/, "").trim();
    const description = (fields.description ?? []).join("\n").trim();
    const tags = (fields["also called"] ?? fields.aliases ?? fields.tags ?? [])
        .join(",")
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);
    return name && description ? { name, description, tags } : null;
};

export const parseTransposedEntry = (text: string): Draft | null => {
    const cleaned = text.replace(/```(?:json)?/gi, "");
    const array = jsonFrom(cleaned, "[", "]");
    const fromArray = Array.isArray(array) ? array.map(fromObject).find(Boolean) : null;
    return fromArray ?? fromObject(jsonFrom(cleaned, "{", "}")) ?? fromLines(cleaned);
};
