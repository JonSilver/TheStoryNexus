import { useSyncExternalStore } from "react";
import { useRouteParams } from "../routeParams";

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
const SCROLL_MEMORY = 100;

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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
    } catch {
        // Private mode or full storage: UI state lasts this session only — nothing the writer made is at stake
    }
    store.listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
};

/**
 * Actions and readers — module-level, so stable by construction: hooks and
 * effects can call them without listing them as dependencies.
 */
export const uiState = {
    get: (): V2State => store.state,
    setCurrentStory: (storyId: string | null) => setState({ currentStoryId: storyId }),
    setLastChapter: (storyId: string, chapterId: string) =>
        setState({
            currentStoryId: storyId,
            lastChapterByStory: { ...store.state.lastChapterByStory, [storyId]: chapterId }
        }),
    setScroll: (chapterId: string, scrollTop: number) => {
        // The most recent chapters only — kept forever, this grew with every chapter ever opened
        const { [chapterId]: _previous, ...others } = store.state.scrollByChapter;
        const recent = Object.entries(others).slice(-(SCROLL_MEMORY - 1));
        setState({ scrollByChapter: { ...Object.fromEntries(recent), [chapterId]: scrollTop } });
    },
    dismissNudges: (storyId: string, names: string[]) => {
        const existing = store.state.dismissedNudgesByStory[storyId] ?? [];
        setState({
            dismissedNudgesByStory: {
                ...store.state.dismissedNudgesByStory,
                [storyId]: [...new Set([...existing, ...names.map(n => n.toLowerCase())])]
            }
        });
    },
    setAutoSummarise: (on: boolean) => setState({ autoSummarise: on }),
    dismissedNudges: (storyId: string): string[] => store.state.dismissedNudgesByStory[storyId] ?? [],
    lastChapterFor: (storyId: string): string | null => store.state.lastChapterByStory[storyId] ?? null,
    scrollFor: (chapterId: string): number => store.state.scrollByChapter[chapterId] ?? 0
};

/** One slice of UI state; the component re-renders only when that slice changes (keep selectors to plain reads). */
export const useUiState = <T>(select: (state: V2State) => T): T =>
    useSyncExternalStore(subscribe, () => select(store.state));

/** The story the writer is in: the URL's, else the remembered one. */
export const useCurrentStoryId = (): string | null => {
    const remembered = useUiState(state => state.currentStoryId);
    return useRouteParams().storyId ?? remembered;
};
