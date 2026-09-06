import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode } from "@lexical/rich-text";
import { debounce } from "lodash";
import { X } from "lucide-react";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Chapter } from "@/types/story";
import { ActionSheet } from "../ai/ActionSheet";
import { useEditorActions } from "../ai/useEditorActions";
import { useV2Store } from "../state/useV2Store";
import { ChapterContextProvider } from "./ChapterContext";
import { GhostSuggestionNode } from "./nodes/GhostSuggestionNode";
import { ImageNode } from "./nodes/ImageNode";
import { SceneBeatNode } from "./nodes/SceneBeatNode";
import { ChapterPersistencePlugin } from "./plugins/ChapterPersistencePlugin";
import { SceneBeatShortcutPlugin } from "./plugins/SceneBeatShortcutPlugin";
import { SlashMenuPlugin } from "./plugins/SlashMenuPlugin";
import { ToolbarPlugin } from "./plugins/ToolbarPlugin";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { findUnmatchedNames } from "../bible/nameNudges";
import { useAutoSummarise } from "./useAutoSummarise";
import { useChapterSaver } from "./useChapterSaver";

const theme = {
    paragraph: "my-3",
    heading: {
        h1: "mb-4 mt-6 text-3xl font-bold",
        h2: "mb-3 mt-5 text-2xl font-semibold",
        h3: "mb-2 mt-4 text-xl font-semibold"
    },
    hr: "my-6 border-t",
    list: {
        ul: "my-3 list-disc pl-6",
        ol: "my-3 list-decimal pl-6",
        listitem: "my-1"
    },
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

const EditorSurface = ({ chapter, onOpenBible }: { chapter: Chapter; onOpenBible?: () => void }) => {
    const { status, scheduleSave } = useChapterSaver(chapter.id, chapter.revision ?? 0, chapter.content);
    const [wordCount, setWordCount] = useState(chapter.wordCount ?? 0);
    const { scrollFor, setScroll } = useV2Store();
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const persistScroll = useRef(debounce((chapterId: string, top: number) => setScroll(chapterId, top), 500)).current;
    const actions = useEditorActions(chapter);
    const { noteActivity } = useAutoSummarise(chapter);
    const { data: bibleEntries } = useHierarchicalLorebookQuery(chapter.storyId);
    const [nudgeNames, setNudgeNames] = useState<string[]>([]);
    const { dismissedNudges, dismissNudges } = useV2Store();
    const detectNames = useRef(
        debounce((text: string, known: string[], dismissed: string[]) => {
            const found = findUnmatchedNames(text, known).filter(name => !dismissed.includes(name.toLowerCase()));
            setNudgeNames(found);
        }, 8000)
    ).current;
    useEffect(() => () => detectNames.cancel(), [detectNames]);

    const onDocument = useCallback(
        (serialised: string, words: number, text: string) => {
            setWordCount(words);
            scheduleSave(serialised, words);
            noteActivity();
            const known = (bibleEntries ?? []).flatMap(e => [e.name, ...((e.tags as string[]) ?? [])]);
            detectNames(text, known, dismissedNudges(chapter.storyId));
        },
        [scheduleSave, noteActivity, bibleEntries, detectNames, dismissedNudges, chapter.storyId]
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
                {nudgeNames.length > 0 && (
                    <div className="flex items-center gap-2 border-b bg-primary/5 px-3 py-1.5 text-xs">
                        <span className="min-w-0 truncate">
                            New name{nudgeNames.length > 1 ? "s" : ""} spotted: <b>{nudgeNames.join(", ")}</b>
                        </span>
                        {onOpenBible && (
                            <button
                                type="button"
                                onClick={onOpenBible}
                                className="shrink-0 rounded-md border px-2 py-0.5"
                            >
                                Add to bible
                            </button>
                        )}
                        <button
                            type="button"
                            aria-label="Dismiss"
                            className="ml-auto shrink-0 text-muted-foreground"
                            onClick={() => {
                                dismissNudges(chapter.storyId, nudgeNames);
                                setNudgeNames([]);
                            }}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
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
                <ListPlugin />
                <SlashMenuPlugin />
                <SceneBeatShortcutPlugin />
                <HistoryPlugin />
                <ChapterPersistencePlugin onDocument={onDocument} />
            </div>
        </ChapterContextProvider>
    );
};

export const ChapterEditor = ({ chapter, onOpenBible }: { chapter: Chapter; onOpenBible?: () => void }) => (
    <ContentGuard key={chapter.id}>
        <LexicalComposer
            initialConfig={{
                namespace: "story-nexus-v2",
                theme,
                nodes: [HeadingNode, HorizontalRuleNode, ListNode, ListItemNode, SceneBeatNode, ImageNode, GhostSuggestionNode],
                editorState: chapter.content || undefined,
                onError: error => {
                    throw error;
                }
            }}
        >
            <EditorSurface chapter={chapter} onOpenBible={onOpenBible} />
        </LexicalComposer>
    </ContentGuard>
);
