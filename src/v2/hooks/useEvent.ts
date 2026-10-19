import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * A stable function that always calls the latest `handler` — React 18's
 * stand-in for useEffectEvent. For event handlers passed to memoised
 * children or long-lived subscriptions; never call it during render.
 */
export const useEvent = <Args extends unknown[], Result>(handler: (...args: Args) => Result) => {
    const latest = useRef(handler);
    useLayoutEffect(() => {
        latest.current = handler;
    });
    return useCallback((...args: Args) => latest.current(...args), []);
};
