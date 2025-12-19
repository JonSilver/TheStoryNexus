import type { JSX } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./FlashMessage.css";

interface FlashMessageProps {
    children: ReactNode;
}

export default function FlashMessage({ children }: FlashMessageProps): JSX.Element {
    return createPortal(
        <div className="FlashMessage__overlay" role="dialog">
            <p className="FlashMessage__alert" role="alert">
                {children}
            </p>
        </div>,
        document.body
    );
}
