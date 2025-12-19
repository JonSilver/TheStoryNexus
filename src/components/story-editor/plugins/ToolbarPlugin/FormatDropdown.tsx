import { FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { MoreHorizontal, Strikethrough } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SHORTCUTS } from "../ShortcutsPlugin/shortcuts";
import { clearFormatting } from "./utils";

interface FormatDropdownProps {
    editor: LexicalEditor;
    disabled: boolean;
}

export const FormatDropdown = ({ editor, disabled }: FormatDropdownProps) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-8 w-8 hover:bg-accent/50 transition-colors"
                aria-label="Formatting options for additional text styles"
            >
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "lowercase")}
            >
                <div className="flex items-center gap-2">
                    <i className="icon lowercase" />
                    <span className="text">Lowercase</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.LOWERCASE}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "uppercase")}
            >
                <div className="flex items-center gap-2">
                    <i className="icon uppercase" />
                    <span className="text">Uppercase</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.UPPERCASE}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "capitalize")}
            >
                <div className="flex items-center gap-2">
                    <i className="icon capitalize" />
                    <span className="text">Capitalize</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.CAPITALIZE}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
            >
                <div className="flex items-center gap-2">
                    <Strikethrough className="h-4 w-4" />
                    <span className="text">Strikethrough</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.STRIKETHROUGH}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "subscript")}
            >
                <div className="flex items-center gap-2">
                    <i className="icon subscript" />
                    <span className="text">Subscript</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.SUBSCRIPT}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "superscript")}
            >
                <div className="flex items-center gap-2">
                    <i className="icon superscript" />
                    <span className="text">Superscript</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.SUPERSCRIPT}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => clearFormatting(editor)}
            >
                <div className="flex items-center gap-2">
                    <i className="icon clear" />
                    <span className="text">Clear Formatting</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.CLEAR_FORMATTING}</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);
