import { debounce } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { findUnmatchedNames } from "../bible/nameNudges";
import { uiState } from "../state/useV2Store";

const SETTLE_MS = 8000;

/** Capitalised names that keep turning up in the chapter but aren't in the bible. */
export const useNameNudges = (storyId: string) => {
    const { data: bibleEntries } = useHierarchicalLorebookQuery(storyId);
    const [names, setNames] = useState<string[]>([]);
    const [detect] = useState(() =>
        debounce((text: string, known: string[], dismissed: string[]) => {
            setNames(findUnmatchedNames(text, known).filter(name => !dismissed.includes(name.toLowerCase())));
        }, SETTLE_MS)
    );
    useEffect(() => () => detect.cancel(), [detect]);

    const noteText = useCallback(
        (text: string) => {
            // No detection until the bible has actually loaded — an empty
            // known list would nudge about names that are already entries
            if (!bibleEntries) return;
            const known = bibleEntries.flatMap(e => [e.name, ...((e.tags as string[]) ?? [])]);
            detect(text, known, uiState.dismissedNudges(storyId));
        },
        [bibleEntries, detect, storyId]
    );

    const dismiss = useCallback(() => {
        uiState.dismissNudges(storyId, names);
        setNames([]);
    }, [storyId, names]);

    /** The names, handed on (e.g. to bible extraction) and cleared from the bar. */
    const take = useCallback(() => {
        setNames([]);
        return names;
    }, [names]);

    return { names, noteText, dismiss, take };
};
