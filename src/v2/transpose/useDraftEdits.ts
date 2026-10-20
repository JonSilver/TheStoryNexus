import { useEffect, useRef, useState } from "react";
import { useEvent } from "../hooks/useEvent";

const SAVE_AFTER_MS = 800;

/**
 * The writer's edits to drafts, kept like the drafts: saved a moment after
 * typing stops, and straight away when the screen closes. An edit shows on
 * top of its draft until the server has it; one it refused stays on screen
 * (the failure is reported by the mutation).
 */
export const useDraftEdits = <T>(save: (index: number, value: T) => Promise<boolean>) => {
    const [edits, setEdits] = useState<Record<number, T>>({});
    const latest = useRef(new Map<number, T>());
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
    const saveLatest = useEvent(save);

    const commit = useEvent((index: number) => {
        timers.current.delete(index);
        const value = latest.current.get(index);
        if (value === undefined) return;
        void saveLatest(index, value).then(saved => {
            // Only if nothing newer was typed meanwhile
            if (!saved || latest.current.get(index) !== value) return;
            latest.current.delete(index);
            setEdits(({ [index]: _saved, ...rest }) => rest as Record<number, T>);
        });
    });

    const edit = (index: number, value: T) => {
        latest.current.set(index, value);
        setEdits(current => ({ ...current, [index]: value }));
        clearTimeout(timers.current.get(index));
        timers.current.set(
            index,
            setTimeout(() => commit(index), SAVE_AFTER_MS)
        );
    };

    useEffect(
        () => () => {
            timers.current.forEach((timer, index) => {
                clearTimeout(timer);
                commit(index);
            });
        },
        [commit]
    );

    return { edits, edit };
};
