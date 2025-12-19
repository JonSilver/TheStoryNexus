import {
    type ElementFormatType,
    FORMAT_ELEMENT_COMMAND,
    INDENT_CONTENT_COMMAND,
    type LexicalEditor,
    OUTDENT_CONTENT_COMMAND
} from "lexical";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SHORTCUTS } from "../ShortcutsPlugin/shortcuts";
import { ELEMENT_FORMAT_OPTIONS } from "./constants";

interface ElementFormatDropdownProps {
    editor: LexicalEditor;
    value: ElementFormatType;
    isRTL: boolean;
    disabled: boolean;
}

export const ElementFormatDropdown = ({ editor, value, isRTL, disabled = false }: ElementFormatDropdownProps) => {
    const formatOption = ELEMENT_FORMAT_OPTIONS[value || "left"];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="h-8 gap-1 font-normal hover:bg-accent/50 transition-colors"
                >
                    {formatOption.name}
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
                >
                    <div className="flex items-center gap-2">
                        <i className="icon left-align" />
                        <span className="text">Left Align</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.LEFT_ALIGN}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
                >
                    <div className="flex items-center gap-2">
                        <i className="icon center-align" />
                        <span className="text">Center Align</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.CENTER_ALIGN}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
                >
                    <div className="flex items-center gap-2">
                        <i className="icon right-align" />
                        <span className="text">Right Align</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.RIGHT_ALIGN}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify")}
                >
                    <div className="flex items-center gap-2">
                        <i className="icon justify-align" />
                        <span className="text">Justify Align</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.JUSTIFY_ALIGN}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "start")}
                >
                    <div className="flex items-center gap-2">
                        <i
                            className={`icon ${isRTL ? ELEMENT_FORMAT_OPTIONS.start.iconRTL : ELEMENT_FORMAT_OPTIONS.start.icon}`}
                        />
                        <span className="text">Start Align</span>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "end")}
                >
                    <div className="flex items-center gap-2">
                        <i
                            className={`icon ${isRTL ? ELEMENT_FORMAT_OPTIONS.end.iconRTL : ELEMENT_FORMAT_OPTIONS.end.icon}`}
                        />
                        <span className="text">End Align</span>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}
                >
                    <div className="flex items-center gap-2">
                        <i className={`icon ${isRTL ? "indent" : "outdent"}`} />
                        <span className="text">Outdent</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.OUTDENT}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}
                >
                    <div className="flex items-center gap-2">
                        <i className={`icon ${isRTL ? "outdent" : "indent"}`} />
                        <span className="text">Indent</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.INDENT}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
