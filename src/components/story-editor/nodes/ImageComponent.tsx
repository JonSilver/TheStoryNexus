import { HashtagNode } from "@lexical/hashtag";
import { LinkNode } from "@lexical/link";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { useCollaborationContext } from "@lexical/react/LexicalCollaborationContext";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HashtagPlugin } from "@lexical/react/LexicalHashtagPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalNestedComposer } from "@lexical/react/LexicalNestedComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import type { LexicalEditor, NodeKey } from "lexical";
import { $getNodeByKey, $isNodeSelection, LineBreakNode, ParagraphNode, RootNode, TextNode } from "lexical";
import type { JSX } from "react";
import { Suspense, useRef, useState } from "react";
import { createWebsocketProvider } from "../collaboration";
import { useSharedHistoryContext } from "../context/SharedHistoryContext";
import LinkPlugin from "../plugins/LinkPlugin";
import ContentEditable from "../ui/ContentEditable";
import ImageResizer from "../ui/ImageResizer";
import { BrokenImage, LazyImage } from "./image/LazyImage";
import { useImageCommands } from "./image/useImageCommands";
import { $isImageNode } from "./ImageNode";
import "./ImageNode.css";

export { RIGHT_CLICK_IMAGE_COMMAND } from "./image/useImageCommands";

interface ImageComponentProps {
    altText: string;
    caption: LexicalEditor;
    height: "inherit" | number;
    maxWidth: number;
    nodeKey: NodeKey;
    resizable: boolean;
    showCaption: boolean;
    src: string;
    width: "inherit" | number;
    captionsEnabled: boolean;
}

export default function ImageComponent({
    src,
    altText,
    nodeKey,
    width,
    height,
    maxWidth,
    resizable,
    showCaption,
    caption,
    captionsEnabled
}: ImageComponentProps): JSX.Element {
    const imageRef = useRef<null | HTMLImageElement>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
    const [isResizing, setIsResizing] = useState<boolean>(false);
    const { isCollabActive } = useCollaborationContext();
    const [editor] = useLexicalComposerContext();
    const [isLoadError, setIsLoadError] = useState<boolean>(false);
    const isEditable = useLexicalEditable();
    const { historyState } = useSharedHistoryContext();

    const { selection, setShowCaption } = useImageCommands({
        editor,
        nodeKey,
        isSelected,
        setSelected,
        clearSelection,
        isResizing,
        showCaption,
        caption,
        imageRef,
        buttonRef
    });

    const onResizeEnd = (nextWidth: "inherit" | number, nextHeight: "inherit" | number) => {
        setTimeout(() => setIsResizing(false), 200);
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isImageNode(node)) node.setWidthAndHeight(nextWidth, nextHeight);
        });
    };

    const onResizeStart = () => setIsResizing(true);

    const draggable = isSelected && $isNodeSelection(selection) && !isResizing;
    const isFocused = (isSelected || isResizing) && isEditable;

    return (
        <Suspense fallback={null}>
            <div draggable={draggable}>
                {isLoadError ? (
                    <BrokenImage />
                ) : (
                    <LazyImage
                        className={isFocused ? `focused ${$isNodeSelection(selection) ? "draggable" : ""}` : null}
                        src={src}
                        altText={altText}
                        imageRef={imageRef}
                        width={width}
                        height={height}
                        maxWidth={maxWidth}
                        onError={() => setIsLoadError(true)}
                    />
                )}
            </div>

            {showCaption && (
                <div className="image-caption-container">
                    <LexicalNestedComposer
                        initialEditor={caption}
                        initialNodes={[RootNode, TextNode, LineBreakNode, ParagraphNode, LinkNode, HashtagNode]}
                    >
                        <AutoFocusPlugin />
                        <LinkPlugin />
                        <HashtagPlugin />
                        {isCollabActive ? (
                            <CollaborationPlugin id={caption.getKey()} providerFactory={createWebsocketProvider} shouldBootstrap={true} />
                        ) : (
                            <HistoryPlugin externalHistoryState={historyState} />
                        )}
                        <RichTextPlugin
                            contentEditable={
                                <ContentEditable
                                    placeholder="Enter a caption..."
                                    placeholderClassName="ImageNode__placeholder"
                                    className="ImageNode__contentEditable"
                                />
                            }
                            ErrorBoundary={LexicalErrorBoundary}
                        />
                    </LexicalNestedComposer>
                </div>
            )}
            {resizable && $isNodeSelection(selection) && isFocused && (
                <ImageResizer
                    showCaption={showCaption}
                    setShowCaption={setShowCaption}
                    editor={editor}
                    buttonRef={buttonRef}
                    imageRef={imageRef}
                    maxWidth={maxWidth}
                    onResizeStart={onResizeStart}
                    onResizeEnd={onResizeEnd}
                    captionsEnabled={!isLoadError && captionsEnabled}
                />
            )}
        </Suspense>
    );
}
