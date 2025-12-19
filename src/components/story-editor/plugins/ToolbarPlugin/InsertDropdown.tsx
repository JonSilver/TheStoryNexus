import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { $createParagraphNode, $getSelection, type LexicalEditor } from "lexical";
import { Bot, ChevronDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { $createSceneBeatNode } from "../../nodes/SceneBeatNode";
import { INSERT_PAGE_BREAK } from "../PageBreakPlugin";
import { SHORTCUTS } from "../ShortcutsPlugin/shortcuts";

interface InsertDropdownProps {
    editor: LexicalEditor;
    activeEditor: LexicalEditor;
    disabled: boolean;
}

export const InsertDropdown = ({ editor, activeEditor, disabled }: InsertDropdownProps) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-8 gap-1 font-normal hover:bg-accent/50 transition-colors"
            >
                Insert
                <ChevronDown className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => activeEditor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
            >
                <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4" />
                    <span className="text">Horizontal Rule</span>
                </div>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => activeEditor.dispatchCommand(INSERT_PAGE_BREAK, undefined)}
            >
                <div className="flex items-center gap-2">
                    <i className="icon page-break" />
                    <span className="text">Page Break</span>
                </div>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => {
                    editor.update(() => {
                        const selection = $getSelection();
                        if (selection) {
                            const beatNode = $createSceneBeatNode();
                            const paragraphNode = $createParagraphNode();
                            selection.insertNodes([beatNode, paragraphNode]);
                        }
                    });
                }}
            >
                <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <span className="text">Scene Beat</span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{SHORTCUTS.SCENE_BEAT}</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);
