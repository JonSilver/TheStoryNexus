import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { Chapter } from "@/types/story";
import { ActionSheet } from "../ai/ActionSheet";
import { useEditorActions } from "../ai/useEditorActions";
import { setNudgeHandoff } from "../bible/nameNudges";
import { blocksToMarkdown, parseSerialisedDocument } from "../export";
import { ChapterContextProvider } from "./ChapterContext";
import { ConflictBanner, NudgeBar } from "./EditorBars";
import { ReferencePanel } from "./components/ReferencePanel";
import { GhostSuggestionNode } from "./nodes/GhostSuggestionNode";
import { ImageNode } from "./nodes/ImageNode";
import { SceneBeatNode } from "./nodes/SceneBeatNode";
import { ChapterPersistencePlugin } from "./plugins/ChapterPersistencePlugin";
import { SceneBeatShortcutPlugin } from "./plugins/SceneBeatShortcutPlugin";
import { SelectionContextMenu } from "./plugins/SelectionContextMenu";
import { SlashMenuPlugin } from "./plugins/SlashMenuPlugin";
import { ToolbarPlugin } from "./plugins/ToolbarPlugin";
import { useAutoSummarise } from "./useAutoSummarise";
import { hasInFlightSave, useChapterSaver, whenSavesSettle } from "./useChapterSaver";
import { useNameNudges } from "./useNameNudges";
import { useScrollMemory } from "./useScrollMemory";

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
                    <p className="font-medium">This chapter can't be opened in the editor.</p>
                    <p className="mt-1 text-muted-foreground">
                        It was written with an old version of the app and uses content this editor doesn't support.
                        Nothing has been changed or lost — it still renders in the story reader and in exports.
                    </p>
                </div>
            );
        return this.props.children;
    }
}

const EditorSurface = ({ chapter, onOpenBible }: { chapter: Chapter; onOpenBible?: () => void }) => {
    const [editor] = useLexicalComposerContext();
    const { noteActivity, noteSaved } = useAutoSummarise(chapter);
    const { status, scheduleSave } = useChapterSaver(chapter.id, chapter.saveVersion ?? 0, chapter.content, noteSaved);

    // The writer's conflicting draft is still on screen — it must be savable
    // BEFORE Reload replaces it with the server copy
    const downloadDraft = () => {
        const serialised = JSON.stringify(editor.getEditorState().toJSON());
        const markdown = blocksToMarkdown(parseSerialisedDocument(serialised));
        const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${chapter.title.replace(/[^\w-]+/g, "-")}-my-version.md`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const scroll = useScrollMemory(chapter.id);
    const actions = useEditorActions(chapter);
    // The one place editability is decided. A conflicted editor must not keep accepting words it
    // will never save; a selection sheet freezes the document under its saved selection
    const editable = status !== "conflict" && !actions.locksEditor;
    useEffect(() => {
        editor.setEditable(editable);
    }, [editor, editable]);
    const nudges = useNameNudges(chapter.storyId);
    const [referenceOpen, setReferenceOpen] = useState(false);
    const identity = useMemo(
        () => ({ storyId: chapter.storyId, chapterId: chapter.id }),
        [chapter.storyId, chapter.id]
    );

    const { noteText } = nudges;
    const onDocument = useCallback(
        (serialised: string, doc: unknown, words: number, text: string) => {
            scheduleSave(serialised, doc, words);
            noteActivity();
            noteText(text);
        },
        [scheduleSave, noteActivity, noteText]
    );

    return (
        <ChapterContextProvider value={identity}>
            <div className="relative flex h-full min-h-0 flex-col">
                <ToolbarPlugin
                    saveStatus={status}
                    initialWordCount={chapter.wordCount ?? 0}
                    storyId={chapter.storyId}
                    actions={actions.toolbarActions}
                    onToggleReference={() => setReferenceOpen(open => !open)}
                />
                {actions.sheetOpen && <ActionSheet {...actions.sheetProps} />}
                {nudges.names.length > 0 && (
                    <NudgeBar
                        names={nudges.names}
                        onAdd={
                            onOpenBible &&
                            (() => {
                                setNudgeHandoff(nudges.take());
                                onOpenBible();
                            })
                        }
                        onDismiss={nudges.dismiss}
                    />
                )}
                {status === "conflict" && <ConflictBanner onDownload={downloadDraft} />}
                <div ref={scroll.restore} className="min-h-0 flex-1 overflow-y-auto" onScroll={scroll.onScroll}>
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
                <SelectionContextMenu actions={actions.toolbarActions} />
                <HistoryPlugin />
                <ChapterPersistencePlugin onDocument={onDocument} />
                {referenceOpen && <ReferencePanel storyId={chapter.storyId} onClose={() => setReferenceOpen(false)} />}
            </div>
        </ChapterContextProvider>
    );
};

export const ChapterEditor = ({ chapter, onOpenBible }: { chapter: Chapter; onOpenBible?: () => void }) => {
    // A previous editor instance's exit save may still be in flight (switch
    // away and back inside the save debounce). Mounting Lexical now would
    // initialise from content that save is about to supersede — hold until it
    // settles and the cache-synced chapter prop arrives.
    const [settling, setSettling] = useState(() => hasInFlightSave(chapter.id));
    // Chapter switches don't remount this component, so re-check per chapter
    useEffect(() => setSettling(hasInFlightSave(chapter.id)), [chapter.id]);
    useEffect(() => {
        if (!settling) return undefined;
        const live = { current: true };
        void whenSavesSettle(chapter.id).then(() => {
            if (live.current) setSettling(false);
        });
        return () => {
            live.current = false;
        };
    }, [settling, chapter.id]);

    if (settling)
        return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Saving…</div>;

    return (
        <ContentGuard key={chapter.id}>
            <LexicalComposer
                initialConfig={{
                    namespace: "story-nexus-v2",
                    theme,
                    nodes: [
                        HeadingNode,
                        HorizontalRuleNode,
                        ListNode,
                        ListItemNode,
                        SceneBeatNode,
                        ImageNode,
                        GhostSuggestionNode
                    ],
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
};
