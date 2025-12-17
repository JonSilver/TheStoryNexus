import { attemptPromise } from "@jfdi/attempt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateStoryDialog } from "@/features/stories/components/CreateStoryDialog";
import { adminApi } from "@/services/api/client";
import { storyExportService } from "@/services/storyExportService";
import { logger } from "@/utils/logger";

interface StoriesToolHeaderProps {
    onStoriesChange: () => void;
}

export const StoriesToolHeader = ({ onStoriesChange }: StoriesToolHeaderProps) => {
    const queryClient = useQueryClient();
    const [isImportingDemo, setIsImportingDemo] = useState(false);
    const [confirmDemoOpen, setConfirmDemoOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { data: demoExists } = useQuery({
        queryKey: ["demoExists"],
        queryFn: () => adminApi.checkDemoExists().then(r => r.exists)
    });

    const handleImportClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleImportStory = async (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];

        const [error] = await attemptPromise(async () => {
            await storyExportService.importStory(file);
            onStoriesChange();
        });

        if (error) logger.error("Import failed:", error);

        event.target.value = "";
    };

    const handleImportDemoStory = async () => {
        setIsImportingDemo(true);
        const [error] = await attemptPromise(async () => {
            await adminApi.importDemoData();
            await queryClient.invalidateQueries();
        });

        if (error) {
            logger.error("Demo import failed:", error);
            toast.error("Failed to import demo story");
        } else 
            toast.success("Demo story imported successfully");
        

        setIsImportingDemo(false);
    };

    return (
        <div className="flex justify-between items-start gap-2">
            <h1 className="text-xl sm:text-2xl font-bold">Your Stories</h1>
            <div className="flex gap-1 sm:gap-2 shrink-0">
                <CreateStoryDialog />
                {/* Desktop: separate buttons */}
                <Button variant="outline" onClick={handleImportClick} className="hidden sm:flex">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Story
                </Button>
                {!demoExists && (
                    <Button
                        variant="ghost"
                        onClick={() => setConfirmDemoOpen(true)}
                        disabled={isImportingDemo}
                        className="hidden sm:flex"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {isImportingDemo ? "Importing..." : "Import Demo"}
                    </Button>
                )}
                {/* Mobile: dropdown menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleImportClick}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import Story
                        </DropdownMenuItem>
                        {!demoExists && (
                            <DropdownMenuItem onClick={() => setConfirmDemoOpen(true)} disabled={isImportingDemo}>
                                <Download className="w-4 h-4 mr-2" />
                                {isImportingDemo ? "Importing..." : "Import Demo Story"}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportStory} />
            </div>
            <ConfirmDialog
                open={confirmDemoOpen}
                onOpenChange={setConfirmDemoOpen}
                title="Import Demo Data"
                description="This will import a demo story with chapters, lorebook entries, and prompts. Continue?"
                onConfirm={handleImportDemoStory}
                confirmLabel="Import"
            />
        </div>
    );
};
