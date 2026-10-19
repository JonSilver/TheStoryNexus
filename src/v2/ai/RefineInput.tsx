import { CornerDownRight } from "lucide-react";
import { useState } from "react";

/** Runs the same action again with the writer's steer; the field empties once it's sent. */
export const RefineInput = ({
    onRefine,
    placeholder = "Refine: e.g. darker, tighter, less dialogue…",
    className = "flex gap-2"
}: {
    onRefine: (guidance: string) => void;
    placeholder?: string;
    className?: string;
}) => {
    const [guidance, setGuidance] = useState("");
    const submit = () => {
        if (!guidance.trim()) return;
        onRefine(guidance.trim());
        setGuidance("");
    };
    return (
        <div className={className}>
            <input
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                maxLength={5000}
                placeholder={placeholder}
                aria-label="Refine with a steer"
                value={guidance}
                onChange={e => setGuidance(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
            />
            <button
                type="button"
                onClick={submit}
                disabled={!guidance.trim()}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm disabled:opacity-50"
            >
                <CornerDownRight className="h-4 w-4" /> Refine
            </button>
        </div>
    );
};
