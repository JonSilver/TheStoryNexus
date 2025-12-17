import { attemptPromise } from "@jfdi/attempt";
import type { MouseEvent } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { DownloadMenu } from "@/components/ui/DownloadMenu";
import { AIGenerateMenu } from "@/components/ui/ai-generate-menu";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useLastUsedPrompt } from "@/features/prompts/hooks/useLastUsedPrompt";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { aiService } from "@/services/ai/AIService";
import { chaptersApi } from "@/services/api/client";
import type { AllowedModel, Chapter, Prompt, PromptParserConfig } from "@/types/story";
import { extractPlainTextFromLexical } from "@/utils/lexicalUtils";
import { logger } from "@/utils/logger";

interface ChapterSummarySectionProps {
    chapter: Chapter;
    storyId: string;
}

export const ChapterSummarySection = ({ chapter, storyId }: ChapterSummarySectionProps) => {
    const [localSummary, setLocalSummary] = useState<string | null>(null);
    const summary = localSummary ?? chapter.summary ?? "";
    const [isGenerating, setIsGenerating] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const updateChapterMutation = useUpdateChapterMutation();
    const { generateWithPrompt } = useGenerateWithPrompt();
    const { data: prompts = [], isLoading, error: queryError } = usePromptsQuery({ includeSystem: true });
    const { lastUsed, saveSelection } = useLastUsedPrompt("gen_summary", prompts);
    const error = queryError?.message ?? null;

    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    useLayoutEffect(() => {
        adjustTextareaHeight();
    }, [adjustTextareaHeight, summary]);

    const handleSaveSummary = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (summary !== chapter.summary)
            updateChapterMutation.mutate(
                { id: chapter.id, data: { summary } },
                {
                    onSuccess: () => {
                        setLocalSummary(null);
                        toast.success("Summary saved successfully");
                    }
                }
            );
    };

    const handleGenerateSummary = async (prompt: Prompt, model: AllowedModel) => {
        saveSelection(prompt, model);
        setIsGenerating(true);

        const [err] = await attemptPromise(async () => {
            const chapterData = await chaptersApi.getById(chapter.id);
            const plainTextContent = chapterData?.content ? extractPlainTextFromLexical(chapterData.content) : "";

            const config: PromptParserConfig = {
                promptId: prompt.id,
                storyId,
                chapterId: chapter.id,
                additionalContext: { plainTextContent }
            };

            const response = await generateWithPrompt(config, model);
            let text = "";

            await new Promise<void>((resolve, reject) => {
                aiService.processStreamedResponse(
                    response,
                    token => {
                        text += token;
                        setLocalSummary(text);
                    },
                    resolve,
                    reject
                );
            });

            updateChapterMutation.mutate(
                { id: chapter.id, data: { summary: text } },
                { onSuccess: () => setLocalSummary(null) }
            );
            toast.success("Summary generated successfully");
        });

        if (err) {
            logger.error("Failed to generate summary:", err);
            toast.error("Failed to generate summary");
        }

        setIsGenerating(false);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={`summary-${chapter.id}`}>Chapter Summary</Label>
                <Textarea
                    ref={textareaRef}
                    id={`summary-${chapter.id}`}
                    placeholder="Enter a brief summary of this chapter..."
                    value={summary}
                    onChange={e => setLocalSummary(e.target.value)}
                    className="min-h-[100px] overflow-hidden"
                />
                <div className="flex justify-between items-center">
                    <Button type="button" variant="secondary" size="sm" onClick={handleSaveSummary}>
                        Save Summary
                    </Button>
                    <AIGenerateMenu
                        isGenerating={isGenerating}
                        isLoading={isLoading}
                        error={error}
                        prompts={prompts}
                        promptType="gen_summary"
                        buttonText="Generate Summary"
                        onGenerate={handleGenerateSummary}
                        lastUsed={lastUsed}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                    <DownloadMenu type="chapter" id={chapter.id} />
                </div>
            </div>
        </div>
    );
};
