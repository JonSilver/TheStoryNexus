import { X } from "lucide-react";

/** New, unrecorded names spotted in the chapter — one tap to the bible. */
export const NudgeBar = ({
    names,
    onAdd,
    onDismiss
}: {
    names: string[];
    onAdd?: () => void;
    onDismiss: () => void;
}) => (
    <div className="flex items-center gap-2 border-b bg-primary/5 px-3 py-1.5 text-xs">
        <span className="min-w-0 truncate">
            New name{names.length > 1 ? "s" : ""} spotted: <b>{names.join(", ")}</b>
        </span>
        {onAdd && (
            <button type="button" onClick={onAdd} className="shrink-0 rounded-md border px-2 py-0.5">
                Add to bible
            </button>
        )}
        <button
            type="button"
            aria-label="Dismiss"
            className="ml-auto shrink-0 text-muted-foreground"
            onClick={onDismiss}
        >
            <X className="h-3.5 w-3.5" />
        </button>
    </div>
);

/** Saving stopped because the chapter changed elsewhere — the writer's version must be downloadable first. */
export const ConflictBanner = ({ onDownload }: { onDownload: () => void }) => (
    <div className="flex flex-wrap items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1">
            This chapter was changed elsewhere. Saving is paused — Reload shows the other version, so download yours
            first.
        </span>
        <button type="button" className="rounded-md border px-2 py-1" onClick={onDownload}>
            Download my version
        </button>
        <button type="button" className="rounded-md border px-2 py-1" onClick={() => window.location.reload()}>
            Reload
        </button>
    </div>
);
