import type { JSX } from "react";
import { createContext, type ReactNode, useCallback, useEffect, useState } from "react";
import FlashMessage from "../ui/FlashMessage";

type ShowFlashMessage = (message?: ReactNode, duration?: number) => void;

interface FlashMessageProps {
    message?: ReactNode;
    duration?: number;
}

const Context = createContext<ShowFlashMessage | undefined>(undefined);
const INITIAL_STATE: FlashMessageProps = {};
const DEFAULT_DURATION = 1000;

export const FlashMessageContext = ({ children }: { children: ReactNode }): JSX.Element => {
    const [props, setProps] = useState(INITIAL_STATE);
    const showFlashMessage = useCallback<ShowFlashMessage>(
        (message, duration) => setProps(message ? { duration, message } : INITIAL_STATE),
        []
    );
    useEffect(() => {
        if (props.message) {
            const timeoutId = setTimeout(() => setProps(INITIAL_STATE), props.duration ?? DEFAULT_DURATION);
            return () => clearTimeout(timeoutId);
        }
        return undefined;
    }, [props]);
    return (
        <Context.Provider value={showFlashMessage}>
            {children}
            {props.message && <FlashMessage>{props.message}</FlashMessage>}
        </Context.Provider>
    );
};

