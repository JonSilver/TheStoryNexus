import { useCallback, useState } from "react";

interface Attempt {
    text: string;
    /** Cut short by a failure — kept, and labelled, rather than thrown away. */
    partial: boolean;
}

/**
 * Every generation that produced text becomes an attempt the writer can flip
 * back to — "Try again" never costs them the previous result (the same
 * promise scene-beat takes make). A failure that produced nothing records
 * nothing, so earlier attempts survive a backend failure; one that produced
 * some text before failing records it as a partial attempt.
 */
export const useAttempts = () => {
    const [state, setState] = useState<{ list: Attempt[]; index: number }>({ list: [], index: 0 });

    const record = useCallback((text: string, partial = false) => {
        if (!text.trim()) return;
        setState(prev => ({ list: [...prev.list, { text, partial }], index: prev.list.length }));
    }, []);

    const select = useCallback(
        (index: number) => setState(prev => ({ ...prev, index: Math.max(0, Math.min(index, prev.list.length - 1)) })),
        []
    );

    const clear = useCallback(() => setState({ list: [], index: 0 }), []);

    const shown = state.list[state.index] ?? null;
    return {
        count: state.list.length,
        index: state.index,
        current: shown?.text ?? null,
        currentPartial: shown?.partial ?? false,
        record,
        select,
        clear
    };
};
