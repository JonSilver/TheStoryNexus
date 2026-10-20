import { useState } from "react";

/** The writer's own draft, written or pasted, kept like the model's (no model call). */
export const OwnDraft = ({
    label,
    onKeep,
    busy
}: {
    label: string;
    onKeep: (text: string) => Promise<boolean>;
    busy: boolean;
}) => {
    const [text, setText] = useState<string | null>(null);
    if (text === null)
        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => setText("")}
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
                {label}
            </button>
        );
    return (
        <div className="w-full space-y-2">
            <textarea
                aria-label={label}
                className="min-h-48 w-full resize-y rounded-md border bg-background p-3 text-sm leading-relaxed"
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={!text.trim() || busy}
                    onClick={() => void onKeep(text.trim()).then(kept => kept && setText(null))}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                    Keep as a draft
                </button>
                <button type="button" onClick={() => setText(null)} className="rounded-md border px-3 py-2 text-sm">
                    Cancel
                </button>
            </div>
        </div>
    );
};
