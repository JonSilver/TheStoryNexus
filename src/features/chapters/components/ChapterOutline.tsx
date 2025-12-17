import { Save } from "lucide-react";
import { useState } from "react";
import type { Chapter } from "@/types/story";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { useUpdateChapterMutation } from "../hooks/useChaptersQuery";

interface ChapterOutlineProps {
    chapter: Chapter;
}

export function ChapterOutline({ chapter }: ChapterOutlineProps) {
    const [outlineContent, setOutlineContent] = useState(chapter?.outline?.content || "");
    const updateChapterMutation = useUpdateChapterMutation();

    const handleSave = async () => {
        if (!chapter) return;

        updateChapterMutation.mutate({
            id: chapter.id,
            data: {
                outline: {
                    content: outlineContent,
                    lastUpdated: new Date()
                }
            }
        });
    };

    return (
        <div className="chapter-outline-container">
            <div className="p-4 border-b flex justify-between items-center">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={updateChapterMutation.isPending || !chapter}
                >
                    <Save className="h-4 w-4 mr-1" />
                    Save Outline
                </Button>
            </div>
            <div className="chapter-outline-content">
                <Textarea
                    className="h-full min-h-[200px] resize-none"
                    placeholder="Enter your chapter outline here..."
                    value={outlineContent}
                    onChange={e => setOutlineContent(e.target.value)}
                    disabled={!chapter}
                />
            </div>
        </div>
    );
}
