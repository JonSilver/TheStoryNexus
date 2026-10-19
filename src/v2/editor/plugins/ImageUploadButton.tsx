import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useMutation } from "@tanstack/react-query";
import { $createParagraphNode, $getRoot, $getSelection } from "lexical";
import { Image as ImageIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "react-toastify";
import { assetsApi } from "@/services/api/client";
import { orThrow } from "@/services/api/request";
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

    const upload = useMutation({
        mutationFn: async (file: File) => orThrow(await assetsApi.upload(storyId, file)),
        onError: (error: Error) => toast.error(error.message || "Image upload failed")
    });

    const uploadAndInsertImage = (file: File) =>
        upload.mutate(file, {
            onSuccess: ({ url }) => {
                onDone?.();
                editor.update(() => {
                    // Focus moved to the file picker, so the editor selection is often
                    // gone by now — fall back to the end of the document
                    const selection = $getSelection() ?? $getRoot().selectEnd();
                    selection.insertNodes([
                        $createImageNode(url, file.name.replace(/\.[^.]+$/, "")),
                        $createParagraphNode()
                    ]);
                });
            }
        });

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
                    if (file) uploadAndInsertImage(file);
                }}
            />
        </>
    );
};
