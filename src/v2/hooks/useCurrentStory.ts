import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { useCurrentStoryId } from "../state/useV2Store";

/** The story the writer is in (the URL's, else the remembered one), once loaded. */
export const useCurrentStory = () => {
    const storyId = useCurrentStoryId();
    return useStoryQuery(storyId ?? "").data ?? null;
};
