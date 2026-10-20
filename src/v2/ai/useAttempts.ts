import { useCallback, useState } from "react";
import type { AnsweredModel } from "@/types/actions";

interface Attempt<T> {
    value: T;
    /** Cut short by a failure — kept, and labelled, rather than thrown away. */
    partial: boolean;
    /** Which model wrote it, when known. */
    model?: AnsweredModel;
}

const isBlank = (value: unknown) => typeof value === "string" && !value.trim();

/**
 * Every generation that produced something becomes an attempt the writer can
 * flip back to — "Try again" never costs them the previous result (the same
 * promise scene-beat takes make). A failure that produced nothing records
 * nothing, so earlier attempts survive a backend failure; one that produced
 * some text before failing records it as a partial attempt. The shown
 * attempt is editable: the writer's changes stay with it.
 */
export const useAttempts = <T = string>() => {
    const [state, setState] = useState<{ list: Attempt<T>[]; index: number }>({ list: [], index: 0 });

    const record = useCallback((value: T, partial = false, model?: AnsweredModel) => {
        if (isBlank(value)) return;
        setState(prev => ({ list: [...prev.list, { value, partial, model }], index: prev.list.length }));
    }, []);

    /** Records it only if it isn't one already — e.g. a result already on screen before any run. */
    const recordIfNew = useCallback((value: T) => {
        if (isBlank(value)) return;
        setState(prev =>
            prev.list.some(attempt => attempt.value === value)
                ? prev
                : { list: [...prev.list, { value, partial: false }], index: prev.list.length }
        );
    }, []);

    const edit = useCallback(
        (value: T) =>
            setState(prev => ({
                ...prev,
                list: prev.list.map((attempt, i) => (i === prev.index ? { ...attempt, value } : attempt))
            })),
        []
    );

    const select = useCallback(
        (index: number) => setState(prev => ({ ...prev, index: Math.max(0, Math.min(index, prev.list.length - 1)) })),
        []
    );

    const clear = useCallback(() => setState({ list: [], index: 0 }), []);

    const shown = state.list[state.index] ?? null;
    return {
        count: state.list.length,
        index: state.index,
        current: shown?.value ?? null,
        currentPartial: shown?.partial ?? false,
        currentModel: shown?.model ?? null,
        /** The attempt at an index, for acting on a selection before the re-render shows it. */
        at: (index: number) => state.list[index]?.value ?? null,
        record,
        recordIfNew,
        edit,
        select,
        clear
    };
};
