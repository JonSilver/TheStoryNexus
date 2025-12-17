import LorebookPage from "@/features/lorebook/pages/LorebookPage";
import { useStoryContext } from "@/features/stories/context/StoryContext";

export const LorebookTool = () => {
    const { currentStoryId } = useStoryContext();

    if (!currentStoryId) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No story selected</p>
            </div>
        );
    }

    // Pass storyId as prop to LorebookPage
    // LorebookPage will fetch hierarchical entries (global + series + story)
    return <LorebookPage storyId={currentStoryId} />;
};
