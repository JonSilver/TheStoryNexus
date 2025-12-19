import type { JSX } from "react";
import type { ReactNode } from "react";
import "./Dialog.css";

type Props = Readonly<{
    "data-test-id"?: string;
    children: ReactNode;
}>;

export function DialogActions({ "data-test-id": dataTestId, children }: Props): JSX.Element {
    return (
        <div className="DialogActions" data-test-id={dataTestId}>
            {children}
        </div>
    );
}
