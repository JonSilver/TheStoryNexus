import { Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "../components/BottomSheet";
import { useManuscriptImport } from "./useManuscriptImport";

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
    const manuscript = useManuscriptImport(onImported);
    const { analysis, review, title, setTitle, busy, commit } = manuscript;

    return (
        <BottomSheet
            title="Import a manuscript"
            onClose={onClose}
            bodyClassName="min-h-[10rem] space-y-3 px-4 pb-4 text-sm"
            footer={
                <>
                    {!analysis ? (
                        <button
                            type="button"
                            onClick={() => manuscript.analyseText(pasted)}
                            disabled={busy || !pasted.trim()}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            Analyse pasted text
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={commit}
                            disabled={busy || manuscript.includedCount === 0}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            {busy ? "Creating…" : `Create story (${manuscript.includedCount} chapters)`}
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </>
            }
        >
            {!analysis ? (
                <>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3">
                        <Upload className="h-4 w-4" />
                        Upload .txt, .md, .docx or .epub — several files welcome (one per chapter or part; ordered by
                        filename)
                        <input
                            type="file"
                            accept=".txt,.md,.docx,.epub"
                            multiple
                            className="hidden"
                            disabled={busy}
                            onChange={e => {
                                const files = Array.from(e.target.files ?? []);
                                e.target.value = "";
                                if (files.length > 0 && !busy) manuscript.analyseFiles(files);
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
                        {manuscript.includedCount} of {review.length} chapters selected — untick to drop, edit titles
                        freely.
                    </p>
                    {review.map(chapter => (
                        <div key={chapter.index} className="flex items-start gap-2 rounded-md border p-2">
                            <input
                                type="checkbox"
                                checked={chapter.included}
                                onChange={() => manuscript.toggleChapter(chapter.index)}
                            />
                            <div className="min-w-0 flex-1">
                                <input
                                    className="w-full rounded-md border bg-background px-2 py-1"
                                    value={chapter.title}
                                    onChange={e => manuscript.renameChapter(chapter.index, e.target.value)}
                                />
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {chapter.wordCount} words · {chapter.preview}
                                </p>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </BottomSheet>
    );
};
