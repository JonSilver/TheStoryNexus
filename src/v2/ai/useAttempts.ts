import { useCallback, useState } from "react";

/**
 * Every completed generation becomes an attempt the writer can flip back to
 * — "Try again" never costs them the previous result (the same promise
 * scene-beat takes make). A failed attempt records nothing, so earlier
 * attempts survive a backend failure.
 */
export const useAttempts = () => {
    const [state, setState] = useState<{ list: string[]; index: number }>({ list: [], index: 0 });

    const record = useCallback((text: string) => {
        if (!text.trim()) return;
        setState(prev => ({ list: [...prev.list, text], index: prev.list.length }));
    }, []);

    const select = useCallback(
        (index: number) => setState(prev => ({ ...prev, index: Math.max(0, Math.min(index, prev.list.length - 1)) })),
        []
    );

    const clear = useCallback(() => setState({ list: [], index: 0 }), []);

    return {
        count: state.list.length,
        index: state.index,
        current: state.list[state.index] ?? null,
        record,
        select,
        clear
    };
};
