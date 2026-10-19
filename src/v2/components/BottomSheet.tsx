import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The app's one bottom sheet: focus trapped while open, Escape and the
 * backdrop close it (through `onClose`, so a sheet can ask before
 * discarding), the page behind doesn't scroll.
 */
export const BottomSheet = ({
    title,
    subtitle,
    onClose,
    headerExtra,
    footer,
    children,
    bodyClassName = "space-y-3 px-4 pb-4 text-sm"
}: {
    title: string;
    subtitle?: ReactNode;
    onClose: () => void;
    /** Controls between the title and the close button. */
    headerExtra?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    bodyClassName?: string;
}) => (
    <DialogPrimitive.Root
        open
        onOpenChange={open => {
            if (!open) onClose();
        }}
    >
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] outline-none"
            >
                <header className="flex items-center gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1">
                        <DialogPrimitive.Title className="block truncate font-medium">{title}</DialogPrimitive.Title>
                        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
                    </span>
                    {headerExtra}
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
                {footer && <footer className="flex flex-wrap gap-2 border-t p-3">{footer}</footer>}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
);
