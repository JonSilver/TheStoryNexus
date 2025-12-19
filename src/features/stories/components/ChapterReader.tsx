import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { HashtagNode } from "@lexical/hashtag";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { MarkNode } from "@lexical/mark";
import { OverflowNode } from "@lexical/overflow";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { useEffect } from "react";
import type { Chapter } from "@/types/story";
import { ImageNode } from "../../../components/story-editor/nodes/ImageNode";
import { InlineImageNode } from "../../../components/story-editor/nodes/InlineImageNode/InlineImageNode";
import { LayoutContainerNode } from "../../../components/story-editor/nodes/LayoutContainerNode";
import { LayoutItemNode } from "../../../components/story-editor/nodes/LayoutItemNode";
import { PageBreakNode } from "../../../components/story-editor/nodes/PageBreakNode";
import { SpecialTextNode } from "../../../components/story-editor/nodes/SpecialTextNode";
import { CollapsibleContainerNode } from "../../../components/story-editor/plugins/CollapsiblePlugin/CollapsibleContainerNode";
import { CollapsibleContentNode } from "../../../components/story-editor/plugins/CollapsiblePlugin/CollapsibleContentNode";
import { CollapsibleTitleNode } from "../../../components/story-editor/plugins/CollapsiblePlugin/CollapsibleTitleNode";
import PlaygroundEditorTheme from "../../../components/story-editor/themes/PlaygroundEditorTheme";

// Read-only nodes - excludes SceneBeatNode which requires LorebookProvider
const ReaderNodes = [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    HashtagNode,
    CodeHighlightNode,
    AutoLinkNode,
    LinkNode,
    OverflowNode,
    ImageNode,
    InlineImageNode,
    HorizontalRuleNode,
    MarkNode,
    CollapsibleContainerNode,
    CollapsibleContentNode,
    CollapsibleTitleNode,
    PageBreakNode,
    LayoutContainerNode,
    LayoutItemNode,
    SpecialTextNode
];

interface ChapterReaderProps {
    chapter: Chapter;
    chapterNumber: number;
}

function LoadContentPlugin({ content }: { content: string }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        if (!content) return;

        editor.update(() => {
            const editorState = editor.parseEditorState(content);
            editor.setEditorState(editorState);
        });
    }, [editor, content]);

    return null;
}

export function ChapterReader({ chapter, chapterNumber }: ChapterReaderProps) {
    const initialConfig = {
        namespace: `ChapterReader-${chapter.id}`,
        nodes: ReaderNodes,
        onError: (error: Error) => {
            console.error("Lexical error:", error);
        },
        theme: PlaygroundEditorTheme,
        editable: false
    };

    return (
        <article className="chapter-reader">
            {/* Chapter header */}
            <div className="mb-6 pb-4 border-b">
                <h2 className="text-xl font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Chapter {chapterNumber}
                </h2>
                <h3 className="text-3xl font-bold">{chapter.title}</h3>
            </div>

            {/* Chapter content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
                <LexicalComposer initialConfig={initialConfig}>
                    <div className="relative">
                        <RichTextPlugin
                            contentEditable={
                                <ContentEditable className="reader-content-editable outline-none min-h-[200px] text-base leading-relaxed" />
                            }
                            placeholder={<div />}
                            ErrorBoundary={LexicalErrorBoundary}
                        />
                        {chapter.content && <LoadContentPlugin content={chapter.content} />}
                    </div>
                </LexicalComposer>
            </div>
        </article>
    );
}
