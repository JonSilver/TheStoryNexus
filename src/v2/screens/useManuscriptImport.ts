import { useState } from "react";
import { toast } from "react-toastify";
import { useAnalyseFiles, useAnalyseText, useCommitImport } from "@/features/ingest/hooks/useIngest";
import type { AnalysedChapter, ManuscriptAnalysis } from "@/services/api/client";

interface ReviewChapter extends AnalysedChapter {
    index: number;
    included: boolean;
}

/**
 * Bring-your-novel flow (contracts Phase 7): upload or paste → the server
 * splits it into chapters → the writer reviews (renames, drops) → one atomic
 * creation.
 */
export const useManuscriptImport = (onImported: (storyId: string) => void) => {
    const [analysis, setAnalysis] = useState<ManuscriptAnalysis | null>(null);
    const [review, setReview] = useState<ReviewChapter[]>([]);
    const [title, setTitle] = useState("");
    const analyseFiles = useAnalyseFiles();
    const analyseText = useAnalyseText();
    const commitImport = useCommitImport();

    const applyAnalysis = (result: ManuscriptAnalysis) => {
        setAnalysis(result);
        setTitle(result.title);
        setReview(result.chapters.map((chapter, index) => ({ ...chapter, index, included: true })));
    };
    const changeChapter = (index: number, change: (chapter: ReviewChapter) => ReviewChapter) =>
        setReview(current => current.map(c => (c.index === index ? change(c) : c)));
    const included = review.filter(c => c.included);

    const commit = () => {
        if (!analysis) return;
        commitImport.mutate(
            {
                token: analysis.token,
                title: title.trim() || "Imported story",
                chapters: included.map(c => ({ index: c.index, title: c.title }))
            },
            {
                onSuccess: ({ storyId, chapterCount }) => {
                    toast.success(
                        `Imported ${chapterCount} chapters — Story Bible → Extract from whole story builds your bible, and Story → Details, series & voice → Derive from my writing drafts your story's voice`
                    );
                    onImported(storyId);
                }
            }
        );
    };

    return {
        analysis,
        review,
        includedCount: included.length,
        title,
        setTitle,
        busy: analyseFiles.isPending || analyseText.isPending || commitImport.isPending,
        analyseFiles: (files: File[]) => analyseFiles.mutate(files, { onSuccess: applyAnalysis }),
        analyseText: (text: string) => analyseText.mutate(text, { onSuccess: applyAnalysis }),
        toggleChapter: (index: number) => changeChapter(index, c => ({ ...c, included: !c.included })),
        renameChapter: (index: number, newTitle: string) => changeChapter(index, c => ({ ...c, title: newTitle })),
        commit
    };
};
