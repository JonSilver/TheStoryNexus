import type { LexicalEditor } from "lexical";
import { ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { blockTypeToBlockName } from "../../context/ToolbarContext";
import {
    formatBulletList,
    formatCheckList,
    formatHeading,
    formatNumberedList,
    formatParagraph,
    formatQuote
} from "./utils";

interface BlockFormatDropDownProps {
    blockType: keyof typeof blockTypeToBlockName;
    rootType: string;
    editor: LexicalEditor;
    disabled: boolean;
}

export const BlockFormatDropDown = ({ editor, blockType, disabled }: BlockFormatDropDownProps): JSX.Element => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-8 gap-1 font-normal hover:bg-accent/50 transition-colors"
            >
                {blockTypeToBlockName[blockType]}
                <ChevronDown className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
            {blockTypeToBlockName.paragraph !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatParagraph(editor)}
                >
                    <span className="text">{blockTypeToBlockName.paragraph}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.h1 !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatHeading(editor, blockType, "h1")}
                >
                    <span className="text">{blockTypeToBlockName.h1}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.h2 !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatHeading(editor, blockType, "h2")}
                >
                    <span className="text">{blockTypeToBlockName.h2}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.h3 !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatHeading(editor, blockType, "h3")}
                >
                    <span className="text">{blockTypeToBlockName.h3}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.bullet !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatBulletList(editor, blockType)}
                >
                    <span className="text">{blockTypeToBlockName.bullet}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.number !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatNumberedList(editor, blockType)}
                >
                    <span className="text">{blockTypeToBlockName.number}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.check !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatCheckList(editor, blockType)}
                >
                    <span className="text">{blockTypeToBlockName.check}</span>
                </DropdownMenuItem>
            )}
            {blockTypeToBlockName.quote !== undefined && (
                <DropdownMenuItem
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => formatQuote(editor, blockType)}
                >
                    <span className="text">{blockTypeToBlockName.quote}</span>
                </DropdownMenuItem>
            )}
        </DropdownMenuContent>
    </DropdownMenu>
);
