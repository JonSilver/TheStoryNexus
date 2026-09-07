/**
 * Plain-text hygiene for imports that lived a former life as email or
 * usenet posts: header blocks, signature blocks, and hard line-wrapping.
 * Applied to .txt/.md/paste only — structured formats don't need it, and
 * every transform is gated on detection so clean text passes untouched.
 */

const HEADER_KEYS = new Set([
    "from",
    "to",
    "cc",
    "subject",
    "date",
    "newsgroups",
    "message-id",
    "path",
    "reply-to",
    "organization",
    "organisation",
    "lines",
    "sender",
    "references",
    "in-reply-to",
    "mime-version",
    "content-type",
    "content-transfer-encoding",
    "keywords",
    "summary",
    "followup-to",
    "archive-name",
    "nntp-posting-host"
]);

const headerKeyOf = (line: string): string | null => {
    const match = /^([A-Za-z][A-Za-z0-9-]*):\s/.exec(line);
    return match ? match[1].toLowerCase() : null;
};

/**
 * Remove RFC822-style header blocks: runs of `Key: value` lines (plus
 * indented continuations) sitting at the start of the text or directly
 * after a blank line. A run only counts as headers when at least two of
 * its keys are recognised — prose containing a stray "Subject:" survives.
 */
export const stripMessageHeaders = (text: string): string => {
    const lines = text.split("\n");
    const kept: string[] = [];
    const state = { i: 0 };
    while (state.i < lines.length) {
        const atBoundary = kept.length === 0 || kept[kept.length - 1].trim() === "";
        if (atBoundary && headerKeyOf(lines[state.i])) {
            const block: string[] = [];
            const known = new Set<string>();
            let j = state.i;
            while (j < lines.length && (headerKeyOf(lines[j]) || /^[ \t]+\S/.test(lines[j]))) {
                const key = headerKeyOf(lines[j]);
                if (key && HEADER_KEYS.has(key) && !key.startsWith("x-")) known.add(key);
                if (key?.startsWith("x-")) known.add(key);
                block.push(lines[j]);
                j += 1;
            }
            if (known.size >= 2) {
                state.i = j;
                // Swallow the blank line after the header block too
                if (lines[state.i]?.trim() === "") state.i += 1;
                continue;
            }
        }
        kept.push(lines[state.i]);
        state.i += 1;
    }
    return kept.join("\n");
};

/** Remove a trailing signature block delimited by the conventional "-- " line. */
export const stripSignature = (text: string): string => {
    const lines = text.split("\n");
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (/^--[ \t]*$/.test(lines[i])) {
            // Only treat as a signature if it's near the end (sigs are short)
            if (lines.length - i <= 12) return lines.slice(0, i).join("\n").trimEnd();
            return text;
        }
        if (lines.length - i > 12) return text;
    }
    return text;
};

const WRAP_MIN = 50;
const WRAP_MAX = 82;

/**
 * Detect hard-wrapped text (the 65–80 column convention) and rejoin each
 * paragraph's lines into flowing prose. Gated: most non-blank lines must sit
 * in the wrap band and continue onto a following line, or nothing changes.
 */
export const unwrapHardLines = (text: string): string => {
    const lines = text.split("\n");
    const continuing = lines.filter(
        (line, i) =>
            line.length >= WRAP_MIN &&
            line.length <= WRAP_MAX &&
            lines[i + 1] !== undefined &&
            lines[i + 1].trim() !== ""
    );
    const candidates = lines.filter(line => line.trim() !== "");
    if (candidates.length < 10 || continuing.length / candidates.length < 0.5) return text;

    // Join a line onto the next ONLY when it looks like wrapped prose:
    // long enough to have hit the wrap column, not a divider or heading.
    // Short lines, scene dividers and headings keep their own line — welding
    // them into kilometre-long lines corrupted structure downstream.
    const structural = /^[ \t]*(?:[*\-–—_~•·][*\-–—_~•· \t]*|#{1,6}[ \t].*|chapter\b.*)$/i;
    return text
        .split(/\n{2,}/)
        .map(paragraph => {
            const parts = paragraph.split("\n").map(line => line.trim());
            return parts
                .map((line, i) =>
                    i < parts.length - 1 &&
                    line.length >= WRAP_MIN &&
                    !structural.test(line) &&
                    !structural.test(parts[i + 1])
                        ? `${line} `
                        : `${line}\n`
                )
                .join("")
                .trimEnd();
        })
        .join("\n\n");
};

export const cleanPlainText = (text: string): string => unwrapHardLines(stripSignature(stripMessageHeaders(text)));
