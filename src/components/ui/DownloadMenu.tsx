import { attemptPromise } from "@jfdi/attempt";
import { Download } from "lucide-react";
import type { MouseEvent } from "react";
import { toast } from "react-toastify";
import { downloadChapter } from "@/utils/export/downloadChapter";
import { downloadStory } from "@/utils/export/downloadStory";
import { logger } from "@/utils/logger";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

interface DownloadMenuProps {
    type: "story" | "chapter";
    id: string;
    variant?: "outline" | "ghost" | "link" | "default" | "destructive" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
    showIcon?: boolean;
    label?: string;
    className?: string;
}

export function DownloadMenu({
    type,
    id,
    variant = "ghost",
    size = "icon",
    showIcon = true,
    label = "Download",
    className = ""
}: DownloadMenuProps) {
    const handleDownload = async (format: "html" | "text" | "markdown" | "epub" | "pdf", e: MouseEvent) => {
        e.stopPropagation();
        const [error] = await attemptPromise(async () => {
            if (type === "story") await downloadStory(id, format);
            else await downloadChapter(id, format);
        });
        if (error) {
            logger.error(`Failed to download ${type}:`, error);
            toast.error(`Failed to download ${type}`, {
                position: "bottom-center",
                autoClose: 2000
            });
            return;
        }
        toast.success(`${type === "story" ? "Story" : "Chapter"} downloaded as ${format.toUpperCase()}`, {
            position: "bottom-center",
            autoClose: 2000
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={variant} size={size} className={`flex items-center gap-1 ${className}`}>
                    {showIcon && <Download className="h-4 w-4" />}
                    {(size !== "icon" || !showIcon) && label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => handleDownload("html", e)}>Download as HTML</DropdownMenuItem>
                <DropdownMenuItem onClick={e => handleDownload("text", e)}>Download as Text</DropdownMenuItem>
                <DropdownMenuItem onClick={e => handleDownload("markdown", e)}>Download as Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={e => handleDownload("epub", e)}>Download as EPUB</DropdownMenuItem>
                <DropdownMenuItem onClick={e => handleDownload("pdf", e)}>Download as PDF</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
