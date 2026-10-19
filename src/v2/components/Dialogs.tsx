import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ConfirmRequest {
    title?: string;
    message: string;
    confirmLabel?: string;
}

interface PromptRequest {
    title: string;
    label: string;
    initial?: string;
    confirmLabel?: string;
}

interface Dialogs {
    /** Resolves true only when the writer confirms. */
    confirm: (request: ConfirmRequest) => Promise<boolean>;
    /** Resolves the entered text (trimmed), or null when cancelled or left empty. */
    prompt: (request: PromptRequest) => Promise<string | null>;
}

const DialogsContext = createContext<Dialogs | null>(null);

type Open =
    | { kind: "confirm"; request: ConfirmRequest; resolve: (ok: boolean) => void }
    | { kind: "prompt"; request: PromptRequest; resolve: (value: string | null) => void };

/** In-app confirm and prompt — the browser's own dialogs can't be styled, read badly on phones, and block the page. */
export const DialogsProvider = ({ children }: { children: ReactNode }) => {
    const [open, setOpen] = useState<Open | null>(null);
    const [draft, setDraft] = useState("");

    const confirm = useCallback(
        (request: ConfirmRequest) => new Promise<boolean>(resolve => setOpen({ kind: "confirm", request, resolve })),
        []
    );
    const prompt = useCallback(
        (request: PromptRequest) =>
            new Promise<string | null>(resolve => {
                setDraft(request.initial ?? "");
                setOpen({ kind: "prompt", request, resolve });
            }),
        []
    );
    const dialogs = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

    const settle = (value: boolean | string | null) => {
        if (!open) return;
        if (open.kind === "confirm") open.resolve(value === true);
        else open.resolve(typeof value === "string" && value.trim() ? value.trim() : null);
        setOpen(null);
    };

    return (
        <DialogsContext.Provider value={dialogs}>
            {children}
            {open?.kind === "confirm" && (
                <ConfirmDialog
                    open
                    onOpenChange={isOpen => !isOpen && settle(false)}
                    title={open.request.title}
                    description={open.request.message}
                    confirmLabel={open.request.confirmLabel}
                    onConfirm={() => settle(true)}
                />
            )}
            {open?.kind === "prompt" && (
                <Dialog open onOpenChange={isOpen => !isOpen && settle(null)}>
                    <DialogContent aria-describedby={undefined}>
                        <DialogHeader>
                            <DialogTitle>{open.request.title}</DialogTitle>
                        </DialogHeader>
                        <form
                            onSubmit={event => {
                                event.preventDefault();
                                settle(draft);
                            }}
                        >
                            <input
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                aria-label={open.request.label}
                                value={draft}
                                onChange={event => setDraft(event.target.value)}
                            />
                            <DialogFooter className="mt-4">
                                <button
                                    type="button"
                                    className="rounded-md border px-4 py-2 text-sm"
                                    onClick={() => settle(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!draft.trim()}
                                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                                >
                                    {open.request.confirmLabel ?? "OK"}
                                </button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </DialogsContext.Provider>
    );
};

const useDialogs = (): Dialogs => {
    const dialogs = useContext(DialogsContext);
    if (!dialogs) throw new Error("useConfirm/usePrompt need a DialogsProvider above them");
    return dialogs;
};

export const useConfirm = () => useDialogs().confirm;
export const usePrompt = () => useDialogs().prompt;

/** Close that asks first when there's something unsaved to lose. */
export const useGuardedClose = (dirty: boolean, onClose: () => void, message = "Close and discard your changes?") => {
    const confirm = useConfirm();
    return async () => {
        if (dirty && !(await confirm({ message, confirmLabel: "Discard" }))) return;
        onClose();
    };
};
