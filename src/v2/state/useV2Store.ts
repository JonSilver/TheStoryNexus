import { useCallback, useSyncExternalStore } from "react";

/**
 * v2 UI state, persisted to localStorage: current story, per-story last
 * chapter, per-chapter scroll anchor. Deliberately independent of the v1
 * StoryContext so the old workspace and the v2 shell never fight.
 */
interface V2State {
    currentStoryId: string | null;
    lastChapterByStory: Record<string, string>;
    scrollByChapter: Record<string, number>;
    dismissedNudgesByStory: Record<string, string[]>;
    /** Background summary refresh spends tokens without being asked — the writer can turn it off. */
    autoSummarise: boolean;
}

const STORAGE_KEY = "v2-state";

const load = (): V2State => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            currentStoryId: typeof parsed.currentStoryId === "string" ? parsed.currentStoryId : null,
            lastChapterByStory: parsed.lastChapterByStory ?? {},
            scrollByChapter: parsed.scrollByChapter ?? {},
            dismissedNudgesByStory: parsed.dismissedNudgesByStory ?? {},
            autoSummarise: parsed.autoSummarise !== false
        };
    } catch {
        return {
            currentStoryId: null,
            lastChapterByStory: {},
            scrollByChapter: {},
            dismissedNudgesByStory: {},
            autoSummarise: true
        };
    }
};

const store = {
    state: load(),
    listeners: new Set<() => void>()
};

const setState = (update: Partial<V2State>) => {
    store.state = { ...store.state, ...update };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
    store.listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
};

export const useV2Store = () => {
    const state = useSyncExternalStore(subscribe, () => store.state);

    const setCurrentStory = useCallback((storyId: string | null) => setState({ currentStoryId: storyId }), []);

    const setLastChapter = useCallback((storyId: string, chapterId: string) => {
        setState({
            currentStoryId: storyId,
            lastChapterByStory: { ...store.state.lastChapterByStory, [storyId]: chapterId }
        });
    }, []);

    const setScroll = useCallback((chapterId: string, scrollTop: number) => {
        setState({ scrollByChapter: { ...store.state.scrollByChapter, [chapterId]: scrollTop } });
    }, []);

    const dismissNudges = useCallback((storyId: string, names: string[]) => {
        const existing = store.state.dismissedNudgesByStory[storyId] ?? [];
        setState({
            dismissedNudgesByStory: {
                ...store.state.dismissedNudgesByStory,
                [storyId]: [...new Set([...existing, ...names.map(n => n.toLowerCase())])]
            }
        });
    }, []);

    return {
        ...state,
        setCurrentStory,
        setLastChapter,
        setScroll,
        dismissNudges,
        setAutoSummarise: (on: boolean) => setState({ autoSummarise: on }),
        dismissedNudges: (storyId: string): string[] => state.dismissedNudgesByStory[storyId] ?? [],
        lastChapterFor: (storyId: string): string | null => state.lastChapterByStory[storyId] ?? null,
        scrollFor: (chapterId: string): number => state.scrollByChapter[chapterId] ?? 0
    };
};
