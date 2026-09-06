import { attemptPromise } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getRoot, $getSelection } from "lexical";
import { Image as ImageIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "react-toastify";
import { $createImageNode } from "../nodes/ImageNode";

export const ImageUploadButton = ({
    storyId,
    className,
    label,
    onDone
}: {
    storyId: string;
    className: string;
    label?: string;
    onDone?: () => void;
}) => {
    const [editor] = useLexicalComposerContext();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const uploadAndInsertImage = async (file: File) => {
        const body = new FormData();
        body.append("file", file);
        const [error, response] = await attemptPromise(() => fetch(`/api/assets/${storyId}`, { method: "POST", body }));
        if (error || !response?.ok) {
            const detail = response ? (await response.json().catch(() => ({})))?.error : undefined;
            toast.error(detail || "Image upload failed");
            return;
        }
        const { url } = await response.json();
        onDone?.();
        editor.update(() => {
            // Focus moved to the file picker, so the editor selection is often
            // gone by now — fall back to the end of the document
            const selection = $getSelection() ?? $getRoot().selectEnd();
            selection.insertNodes([$createImageNode(url, file.name.replace(/\.[^.]+$/, "")), $createParagraphNode()]);
        });
    };

    return (
        <>
            <button
                type="button"
                className={className}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Insert image"
            >
                <ImageIcon className="h-4 w-4" />
                {label}
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                className="hidden"
                tabIndex={-1}
                onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadAndInsertImage(file);
                }}
            />
        </>
    );
};
