import { HelpCircle, Search, Settings } from "lucide-react";
import { useNavigate } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { ChapterSwitcher } from "./ChapterSwitcher";

interface TopBarProps {
    onOpenCommandPalette: () => void;
}

export const TopBar = ({ onOpenCommandPalette }: TopBarProps) => {
    const { currentStoryId, setCurrentStoryId } = useStoryContext();
    const { data: stories } = useStoriesQuery();
    const navigate = useNavigate();

    const currentStory = stories?.find(s => s.id === currentStoryId);

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40">
            <div className="flex h-14 items-center px-2 sm:px-4 gap-2 sm:gap-4">
                {/* App Title - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-2 font-semibold text-lg whitespace-nowrap">
                    Story Nexus
                </div>

                {/* Story Selector */}
                {currentStory && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-1 sm:gap-2 max-w-[140px] sm:max-w-none">
                                <span className="truncate">{currentStory.title}</span>
                                <span className="text-muted-foreground shrink-0">▾</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                            {stories?.map(story => (
                                <DropdownMenuItem
                                    key={story.id}
                                    onClick={() => setCurrentStoryId(story.id)}
                                    className={story.id === currentStoryId ? "bg-accent" : ""}
                                >
                                    {story.title}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Chapter Switcher */}
                <ChapterSwitcher />

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions */}
                <TooltipProvider>
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Command Palette - hidden on mobile */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hidden sm:inline-flex h-9 w-9"
                                    onClick={onOpenCommandPalette}
                                >
                                    <Search className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Command Palette</p>
                                <p className="text-xs text-muted-foreground">
                                    {navigator.platform.toUpperCase().includes("MAC") ? "⌘K" : "Ctrl+K"}
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => navigate("/settings")}
                                >
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Settings</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Guide - hidden on mobile */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hidden sm:inline-flex h-9 w-9"
                                    onClick={() => navigate("/guide")}
                                >
                                    <HelpCircle className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Guide</p>
                            </TooltipContent>
                        </Tooltip>

                        <ThemeToggle />
                    </div>
                </TooltipProvider>
            </div>
        </header>
    );
};
