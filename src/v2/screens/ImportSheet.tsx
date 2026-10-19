import { Loader2, Upload, X } from "lucide-react";
import { useState } from "react";
import { useAnalyseFiles, useAnalyseText, useCommitImport } from "@/features/ingest/hooks/useIngest";
import type { AnalysedChapter, ManuscriptAnalysis } from "@/services/api/client";

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
    const [pasted, setPasted] = useState("");
    const [analysis, setAnalysis] = useState<ManuscriptAnalysis | null>(null);
    const [review, setReview] = useState<ReviewChapter[]>([]);
    const [title, setTitle] = useState("");

    const applyAnalysis = (result: ManuscriptAnalysis) => {
        setAnalysis(result);
        setTitle(result.title);
        setReview(result.chapters.map((chapter, index) => ({ ...chapter, index, included: true })));
    };

    const analyseFiles = useAnalyseFiles();
    const analyseText = useAnalyseText();
    const commitImport = useCommitImport();
    const busy = analyseFiles.isPending || analyseText.isPending || commitImport.isPending;

    const commit = () => {
        if (!analysis) return;
        const chapters = review.filter(c => c.included).map(c => ({ index: c.index, title: c.title }));
        commitImport.mutate(
            { token: analysis.token, title: title.trim() || "Imported story", chapters },
            { onSuccess: ({ storyId }) => onImported(storyId) }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            role="dialog"
            aria-label="Import manuscript"
        >
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
                                Upload .txt, .md, .docx or .epub — several files welcome (one per chapter or part;
                                ordered by filename)
                                <input
                                    type="file"
                                    accept=".txt,.md,.docx,.epub"
                                    multiple
                                    className="hidden"
                                    disabled={busy}
                                    onChange={e => {
                                        const files = Array.from(e.target.files ?? []);
                                        e.target.value = "";
                                        if (files.length > 0 && !busy)
                                            analyseFiles.mutate(files, { onSuccess: applyAnalysis });
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
                                aria-label="Story title"
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
                            onClick={() => analyseText.mutate(pasted, { onSuccess: applyAnalysis })}
                            disabled={busy || !pasted.trim()}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            Analyse pasted text
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={commit}
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
