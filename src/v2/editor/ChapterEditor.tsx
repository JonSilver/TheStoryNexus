import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import { debounce } from "lodash";
import { Component, type ReactNode, useCallback, useRef, useState } from "react";
import type { Chapter } from "@/types/story";
import { ActionSheet } from "../ai/ActionSheet";
import { useEditorActions } from "../ai/useEditorActions";
import { useV2Store } from "../state/useV2Store";
import { ChapterContextProvider } from "./ChapterContext";
import { ImageNode } from "./nodes/ImageNode";
import { SceneBeatNode } from "./nodes/SceneBeatNode";
import { ChapterPersistencePlugin } from "./plugins/ChapterPersistencePlugin";
import { ToolbarPlugin } from "./plugins/ToolbarPlugin";
import { useChapterSaver } from "./useChapterSaver";

const theme = {
    paragraph: "my-3",
    heading: {
        h1: "mb-4 mt-6 text-3xl font-bold",
        h2: "mb-3 mt-5 text-2xl font-semibold",
        h3: "mb-2 mt-4 text-xl font-semibold"
    },
    hr: "my-6 border-t",
    text: { bold: "font-bold", italic: "italic", underline: "underline" }
};

/**
 * Guard against content this editor cannot parse (e.g. v1 playground
 * documents full of node types v2 doesn't register). The v1 loader's
 * behaviour — replace unparseable content with an empty document — is
 * exactly what we must never do: fail read-only instead.
 */
class ContentGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (this.state.failed)
            return (
                <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <p className="font-medium">This chapter can't be opened in the v2 editor.</p>
                    <p className="mt-1 text-muted-foreground">
                        It was probably written with the v1 editor. Open it from the v1 workspace instead — nothing has
                        been changed or lost.
                    </p>
                </div>
            );
        return this.props.children;
    }
}

const EditorSurface = ({ chapter }: { chapter: Chapter }) => {
    const { status, scheduleSave } = useChapterSaver(chapter.id, chapter.revision ?? 0, chapter.content);
    const [wordCount, setWordCount] = useState(chapter.wordCount ?? 0);
    const { scrollFor, setScroll } = useV2Store();
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const persistScroll = useRef(debounce((chapterId: string, top: number) => setScroll(chapterId, top), 500)).current;
    const actions = useEditorActions(chapter);

    const onDocument = useCallback(
        (serialised: string, words: number) => {
            setWordCount(words);
            scheduleSave(serialised, words);
        },
        [scheduleSave]
    );

    const restoreScroll = useCallback(
        (el: HTMLDivElement | null) => {
            scrollerRef.current = el;
            if (el) el.scrollTop = scrollFor(chapter.id);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [chapter.id]
    );

    return (
        <ChapterContextProvider value={{ storyId: chapter.storyId, chapterId: chapter.id }}>
            <div className="flex h-full min-h-0 flex-col">
                <ToolbarPlugin
                    saveStatus={status}
                    wordCount={wordCount}
                    storyId={chapter.storyId}
                    actions={actions.toolbarActions}
                />
                <ActionSheet {...actions.sheetProps} />
                {status === "conflict" && (
                    <div className="flex items-center justify-between border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                        <span>This chapter was changed on another device. Saving is paused.</span>
                        <button
                            type="button"
                            className="rounded-md border px-2 py-1"
                            onClick={() => window.location.reload()}
                        >
                            Reload
                        </button>
                    </div>
                )}
                <div
                    ref={restoreScroll}
                    className="min-h-0 flex-1 overflow-y-auto"
                    onScroll={e => persistScroll(chapter.id, e.currentTarget.scrollTop)}
                >
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable
                                className="mx-auto min-h-[60vh] max-w-2xl px-4 py-6 text-base leading-relaxed outline-none"
                                aria-label="Chapter content"
                            />
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                </div>
                <HistoryPlugin />
                <ChapterPersistencePlugin onDocument={onDocument} />
            </div>
        </ChapterContextProvider>
    );
};

export const ChapterEditor = ({ chapter }: { chapter: Chapter }) => (
    <ContentGuard key={chapter.id}>
        <LexicalComposer
            initialConfig={{
                namespace: "story-nexus-v2",
                theme,
                nodes: [HeadingNode, HorizontalRuleNode, SceneBeatNode, ImageNode],
                editorState: chapter.content || undefined,
                onError: error => {
                    throw error;
                }
            }}
        >
            <EditorSurface chapter={chapter} />
        </LexicalComposer>
    </ContentGuard>
);
