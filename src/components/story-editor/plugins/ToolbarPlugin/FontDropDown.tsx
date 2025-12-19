import { $patchStyleText } from "@lexical/selection";
import { $getSelection, type LexicalEditor } from "lexical";
import { ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from "./constants";

interface FontDropDownProps {
    editor: LexicalEditor;
    value: string;
    style: string;
    disabled?: boolean;
}

export const FontDropDown = ({ editor, value, style, disabled = false }: FontDropDownProps): JSX.Element => {
    const handleClick = useCallback(
        (option: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if (selection !== null)
                    $patchStyleText(selection, {
                        [style]: option
                    });
            });
        },
        [editor, style]
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="h-8 gap-1 font-normal hover:bg-accent/50 transition-colors"
                >
                    {value}
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
                {(style === "font-family" ? FONT_FAMILY_OPTIONS : FONT_SIZE_OPTIONS).map(([option, text]) => (
                    <DropdownMenuItem
                        key={option}
                        className="hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleClick(option)}
                    >
                        <span className="text">{text}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
