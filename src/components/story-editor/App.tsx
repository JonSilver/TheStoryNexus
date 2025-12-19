import { LexicalComposer } from "@lexical/react/LexicalComposer";
import type { JSX } from "react";
import { logger } from "@/utils/logger";
import Editor from "./Editor";
import { FlashMessageContext } from "./context/FlashMessageContext";
import { SettingsContext } from "./context/SettingsContext";
import { SharedHistoryContext } from "./context/SharedHistoryContext";
import { ToolbarContext } from "./context/ToolbarContext";
import PlaygroundNodes from "./nodes";
import PlaygroundEditorTheme from "./themes/PlaygroundEditorTheme";

function App(): JSX.Element {
    const initialConfig = {
        namespace: "Playground",
        nodes: [...PlaygroundNodes],
        onError: (error: Error) => {
            logger.error("Lexical Error:", error);
        },
        theme: PlaygroundEditorTheme
    };

    return (
        <LexicalComposer initialConfig={initialConfig}>
            <SharedHistoryContext>
                <ToolbarContext>
                    <div className="editor-shell">
                        <Editor />
                    </div>
                </ToolbarContext>
            </SharedHistoryContext>
        </LexicalComposer>
    );
}

export default function PlaygroundApp(): JSX.Element {
    return (
        <SettingsContext>
            <FlashMessageContext>
                <App />
            </FlashMessageContext>
        </SettingsContext>
    );
}
