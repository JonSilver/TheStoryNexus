import { useState } from "react";
import { attemptPromise } from "@jfdi/attempt";
import { Loader2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

interface AnalysedChapter {
    title: string;
    wordCount: number;
    preview: string;
}

interface Analysis {
    token: string;
    title: string;
    chapters: AnalysedChapter[];
}

interface ReviewChapter extends AnalysedChapter {
    index: number;
    included: boolean;
}

/**
 * Bring-your-novel flow (contracts Phase 7): upload or paste → server
 * splits into chapters → review (rename/drop) → atomic creation.
 */
export const ImportSheet = ({
    onClose,
    onImported
}: {
    onClose: () => void;
    onImported: (storyId: string) => void;
}) => {
    const queryClient = useQueryClient();
    const [pasted, setPasted] = useState("");
    const [busy, setBusy] = useState(false);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [review, setReview] = useState<ReviewChapter[]>([]);
    const [title, setTitle] = useState("");

    const applyAnalysis = (result: Analysis) => {
        setAnalysis(result);
        setTitle(result.title);
        setReview(result.chapters.map((chapter, index) => ({ ...chapter, index, included: true })));
    };

    const analyseFile = async (file: File) => {
        setBusy(true);
        const body = new FormData();
        body.append("file", file);
        const [error, response] = await attemptPromise(() => fetch("/api/ingest/analyse", { method: "POST", body }));
        setBusy(false);
        if (error || !response?.ok) {
            const detail = response ? (await response.json().catch(() => ({})))?.error : undefined;
            toast.error(detail || "Couldn't read that file");
            return;
        }
        applyAnalysis(await response.json());
    };

    const analyseText = async () => {
        setBusy(true);
        const [error, response] = await attemptPromise(() =>
            fetch("/api/ingest/analyse-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: pasted })
            })
        );
        setBusy(false);
        if (error || !response?.ok) {
            toast.error("Couldn't analyse that text");
            return;
        }
        applyAnalysis(await response.json());
    };

    const commit = async () => {
        if (!analysis) return;
        setBusy(true);
        const chapters = review.filter(c => c.included).map(c => ({ index: c.index, title: c.title }));
        const [error, response] = await attemptPromise(() =>
            fetch("/api/ingest/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: analysis.token, title: title.trim() || "Imported story", chapters })
            })
        );
        setBusy(false);
        if (error || !response?.ok) {
            const detail = response ? (await response.json().catch(() => ({})))?.error : undefined;
            toast.error(detail || "Import failed — nothing was created");
            return;
        }
        const { storyId, chapterCount } = await response.json();
        void queryClient.invalidateQueries();
        toast.success(`Imported ${chapterCount} chapters — try Story Bible → Extract to build your bible`);
        onImported(storyId);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-label="Import manuscript">
            <div className="flex max-h-[90dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">Import a manuscript</span>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="min-h-[10rem] flex-1 space-y-3 overflow-y-auto px-4 pb-4 text-sm">
                    {!analysis ? (
                        <>
                            <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3">
                                <Upload className="h-4 w-4" />
                                Upload .txt, .md, .docx or .epub
                                <input
                                    type="file"
                                    accept=".txt,.md,.docx,.epub"
                                    className="hidden"
                                    disabled={busy}
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (file && !busy) void analyseFile(file);
                                    }}
                                />
                            </label>
                            <p className="text-center text-xs text-muted-foreground">or</p>
                            <textarea
                                className="min-h-32 w-full resize-y rounded-md border bg-background p-2"
                                placeholder="Paste your manuscript here…"
                                value={pasted}
                                onChange={e => setPasted(e.target.value)}
                            />
                            {busy && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                        </>
                    ) : (
                        <>
                            <input
                                className="w-full rounded-md border bg-background px-3 py-2"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Story title"
                            />
                            <p className="text-xs text-muted-foreground">
                                {review.filter(c => c.included).length} of {review.length} chapters selected — untick to
                                drop, edit titles freely.
                            </p>
                            {review.map(chapter => (
                                <div key={chapter.index} className="flex items-start gap-2 rounded-md border p-2">
                                    <input
                                        type="checkbox"
                                        checked={chapter.included}
                                        onChange={() =>
                                            setReview(current =>
                                                current.map(c =>
                                                    c.index === chapter.index ? { ...c, included: !c.included } : c
                                                )
                                            )
                                        }
                                    />
                                    <div className="min-w-0 flex-1">
                                        <input
                                            className="w-full rounded-md border bg-background px-2 py-1"
                                            value={chapter.title}
                                            onChange={e =>
                                                setReview(current =>
                                                    current.map(c =>
                                                        c.index === chapter.index ? { ...c, title: e.target.value } : c
                                                    )
                                                )
                                            }
                                        />
                                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                            {chapter.wordCount} words · {chapter.preview}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <footer className="flex gap-2 border-t p-3">
                    {!analysis ? (
                        <button
                            type="button"
                            onClick={() => void analyseText()}
                            disabled={busy || !pasted.trim()}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            Analyse pasted text
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void commit()}
                            disabled={busy || review.every(c => !c.included)}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            {busy ? "Creating…" : `Create story (${review.filter(c => c.included).length} chapters)`}
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </footer>
            </div>
        </div>
    );
};
