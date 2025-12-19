import { FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { Bold, Italic, Underline } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";

interface FormatButtonsProps {
    editor: LexicalEditor;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
}

export const FormatButtons = ({ editor, isBold, isItalic, isUnderline }: FormatButtonsProps): JSX.Element => (
    <>
        <Button
            variant={isBold ? "default" : "outline"}
            size="sm"
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
            title="Bold"
            aria-label="Format text as bold"
        >
            <Bold className="h-4 w-4" />
        </Button>
        <Button
            variant={isItalic ? "default" : "outline"}
            size="sm"
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
            title="Italic"
            aria-label="Format text as italics"
        >
            <Italic className="h-4 w-4" />
        </Button>
        <Button
            variant={isUnderline ? "default" : "outline"}
            size="sm"
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
            title="Underline"
            aria-label="Format text to underlined"
        >
            <Underline className="h-4 w-4" />
        </Button>
    </>
);
