import { debounce } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { uiState } from "../state/useV2Store";

/** Remembers where the writer was in each chapter; restores it when the chapter opens. */
export const useScrollMemory = (chapterId: string) => {
    const [persist] = useState(() => debounce((id: string, top: number) => uiState.setScroll(id, top), 500));
    // The last position before leaving is the one that matters
    useEffect(() => () => persist.flush(), [persist]);
    const restore = useCallback(
        (element: HTMLDivElement | null) => {
            if (element) element.scrollTop = uiState.scrollFor(chapterId);
        },
        [chapterId]
    );
    const onScroll = useCallback(
        (event: React.UIEvent<HTMLDivElement>) => persist(chapterId, event.currentTarget.scrollTop),
        [persist, chapterId]
    );
    return { restore, onScroll };
};
