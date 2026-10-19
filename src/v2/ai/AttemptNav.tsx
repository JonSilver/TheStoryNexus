/** ‹ n of m › for flipping between kept results — attempts, merges, versions. */
export const AttemptNav = ({
    label,
    index,
    count,
    onSelect,
    disabled = false,
    className = "flex items-center justify-center gap-3 px-3 pb-2 text-sm"
}: {
    /** e.g. "Attempt", "Merge" — also names the buttons ("Previous attempt"). */
    label: string;
    index: number;
    count: number;
    onSelect: (index: number) => void;
    disabled?: boolean;
    className?: string;
}) => (
    <div className={className}>
        <button
            type="button"
            onClick={() => onSelect(index - 1)}
            disabled={disabled || index === 0}
            aria-label={`Previous ${label.toLowerCase()}`}
            className="rounded-md border px-2 py-0.5 disabled:opacity-40"
        >
            ‹
        </button>
        <span className="text-muted-foreground">
            {label} {index + 1} of {count}
        </span>
        <button
            type="button"
            onClick={() => onSelect(index + 1)}
            disabled={disabled || index === count - 1}
            aria-label={`Next ${label.toLowerCase()}`}
            className="rounded-md border px-2 py-0.5 disabled:opacity-40"
        >
            ›
        </button>
    </div>
);
