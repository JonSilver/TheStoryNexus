import { Button } from "@/components/ui/button";
import { useStoryContext, type WorkspaceTool } from "@/features/stories/context/StoryContext";
import { cn } from "@/lib/utils";
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    FileEdit,
    FileText,
    Layers,
    Library,
    List,
    MessageSquare,
    StickyNote
} from "lucide-react";
import { version } from "../../../package.json";
import { useWorkspace } from "./context/WorkspaceContext";

const tools = [
    { id: "stories" as WorkspaceTool, label: "Stories", icon: Library, requiresStory: false },
    { id: "series" as WorkspaceTool, label: "Series", icon: Layers, requiresStory: false },
    { id: "editor" as WorkspaceTool, label: "Editor", icon: FileEdit, requiresStory: true },
    { id: "chapters" as WorkspaceTool, label: "Chapters", icon: List, requiresStory: true },
    { id: "lorebook" as WorkspaceTool, label: "Lorebook", icon: BookOpen, requiresStory: true },
    { id: "brainstorm" as WorkspaceTool, label: "Brainstorm", icon: MessageSquare, requiresStory: true },
    { id: "prompts" as WorkspaceTool, label: "Prompts", icon: FileText, requiresStory: true },
    { id: "notes" as WorkspaceTool, label: "Notes", icon: StickyNote, requiresStory: true }
];

export const Sidebar = () => {
    const { currentTool, setCurrentTool, currentStoryId } = useStoryContext();
    const { leftSidebar, toggleLeftSidebar } = useWorkspace();
    const collapsed = leftSidebar.collapsed;

    const handleToolClick = (toolId: WorkspaceTool, requiresStory: boolean) => {
        if (requiresStory && !currentStoryId) return;
        setCurrentTool(toolId);
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    "hidden md:flex flex-col border-r bg-muted/30 transition-all duration-200",
                    collapsed ? "w-12" : "w-32"
                )}
            >
                <nav className="flex-1 p-2 space-y-1">
                    {tools.map(tool => {
                        const Icon = tool.icon;
                        const isActive = currentTool === tool.id;
                        const isDisabled = tool.requiresStory && !currentStoryId;

                        return (
                            <Button
                                key={tool.id}
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full gap-2",
                                    collapsed ? "justify-center px-0" : "justify-start",
                                    isDisabled && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => handleToolClick(tool.id, tool.requiresStory)}
                                disabled={isDisabled}
                                title={collapsed ? tool.label : undefined}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {!collapsed && <span className="text-sm">{tool.label}</span>}
                            </Button>
                        );
                    })}
                </nav>

                <div className="p-2 border-t space-y-2">
                    <div className="text-xs text-muted-foreground text-center">
                        {collapsed ? `v${version}` : `Version ${version}`}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-full"
                        onClick={toggleLeftSidebar}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                </div>
            </aside>

            {/* Mobile Bottom Toolbar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-50 safe-area-inset-bottom">
                <div className="flex justify-around p-1 sm:p-2">
                    {tools.map(tool => {
                        const Icon = tool.icon;
                        const isActive = currentTool === tool.id;
                        const isDisabled = tool.requiresStory && !currentStoryId;

                        return (
                            <Button
                                key={tool.id}
                                variant={isActive ? "secondary" : "ghost"}
                                size="sm"
                                className={cn(
                                    "flex-col h-auto py-1.5 px-1 sm:px-2 gap-0.5 min-w-0",
                                    isDisabled && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => handleToolClick(tool.id, tool.requiresStory)}
                                disabled={isDisabled}
                            >
                                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                <span className="text-[10px] sm:text-xs truncate max-w-[40px] sm:max-w-none">
                                    {tool.label}
                                </span>
                            </Button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};
