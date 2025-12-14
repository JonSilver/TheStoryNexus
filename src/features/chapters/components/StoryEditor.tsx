import { Button } from "@/components/ui/button";
import { DownloadMenu } from "@/components/ui/DownloadMenu";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/components/workspace/context/WorkspaceContext";
import { ChapterNotesEditor } from "@/features/chapters/components/ChapterNotesEditor";
import { ChapterPOVEditor } from "@/features/chapters/components/ChapterPOVEditor";
import { MatchedTagEntries } from "@/features/chapters/components/MatchedTagEntries";
import { useChapterQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import EmbeddedPlayground from "@/Lexical/lexical-playground/src/EmbeddedPlayground";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronLeft, ChevronRight, LucideIcon, StickyNote, Tags, User } from "lucide-react";
import { useState } from "react";
import { ChapterOutline } from "./ChapterOutline";

type DrawerType = "matchedTags" | "chapterOutline" | "chapterPOV" | "chapterNotes" | null;

const sidebarButtons: { id: DrawerType; icon: LucideIcon; label: string; title: string }[] = [
    { id: "matchedTags", icon: Tags, label: "Tags", title: "Matched Tags" },
    { id: "chapterOutline", icon: BookOpen, label: "Outline", title: "Chapter Outline" },
    { id: "chapterPOV", icon: User, label: "POV", title: "Edit POV" },
    { id: "chapterNotes", icon: StickyNote, label: "Notes", title: "Chapter Notes" }
];

export function StoryEditor() {
    const [openDrawer, setOpenDrawer] = useState<DrawerType>(null);
    const { currentChapterId } = useStoryContext();
    const { data: currentChapter } = useChapterQuery(currentChapterId || "");
    const { rightSidebar, toggleRightSidebar, isMaximised } = useWorkspace();
    const collapsed = rightSidebar.collapsed;

    const toggleDrawer = (drawer: DrawerType) => setOpenDrawer(drawer === openDrawer ? null : drawer);

    return (
        <div className="h-full flex">
            <div className={cn("flex-1 flex justify-center", !isMaximised && "px-4")}>
                <div className={cn("h-full flex flex-col", isMaximised ? "w-full" : "max-w-[1024px] w-full")}>
                    <EmbeddedPlayground />
                </div>
            </div>

            <aside
                className={cn(
                    "hidden md:flex flex-col border-l bg-muted/20 transition-all duration-200",
                    collapsed ? "w-12" : "w-36"
                )}
            >
                <div className="flex-1 py-2 space-y-2">
                    {sidebarButtons.map(({ id, icon: Icon, label, title }) => (
                        <Button
                            key={id}
                            variant={openDrawer === id ? "default" : "outline"}
                            size="sm"
                            className={cn("mx-2", collapsed ? "justify-center px-0 w-8" : "justify-start")}
                            onClick={() => toggleDrawer(id)}
                            title={title}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span className="ml-2">{label}</span>}
                        </Button>
                    ))}

                    {currentChapterId && !collapsed && (
                        <DownloadMenu
                            type="chapter"
                            id={currentChapterId}
                            variant="outline"
                            size="sm"
                            showIcon={true}
                            label="Download"
                            className="mx-2 justify-start"
                        />
                    )}
                </div>

                <div className="p-2 border-t">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-full"
                        onClick={toggleRightSidebar}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                </div>
            </aside>

            {/* Matched Tags Drawer */}
            <Drawer open={openDrawer === "matchedTags"} onOpenChange={open => !open && setOpenDrawer(null)}>
                <DrawerContent className="max-h-[80vh]">
                    <DrawerHeader>
                        <DrawerTitle>Matched Tag Entries</DrawerTitle>
                        <DrawerDescription>Lorebook entries that match tags in your current chapter.</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 overflow-y-auto max-h-[60vh]">
                        <MatchedTagEntries />
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline">Close</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* Chapter Outline Drawer */}
            <Drawer open={openDrawer === "chapterOutline"} onOpenChange={open => !open && setOpenDrawer(null)}>
                <DrawerContent className="max-h-[80vh]">
                    <DrawerHeader>
                        <DrawerTitle>Chapter Outline</DrawerTitle>
                        <DrawerDescription>Outline and notes for your current chapter.</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 overflow-y-auto max-h-[60vh]">
                        {currentChapter && <ChapterOutline key={currentChapter.id} chapter={currentChapter} />}
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline">Close</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* Chapter POV Drawer */}
            <Drawer open={openDrawer === "chapterPOV"} onOpenChange={open => !open && setOpenDrawer(null)}>
                <DrawerContent className="max-h-[80vh]">
                    <DrawerHeader>
                        <DrawerTitle>Edit Chapter POV</DrawerTitle>
                        <DrawerDescription>
                            Change the point of view character and perspective for this chapter.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 overflow-y-auto max-h-[60vh]">
                        {currentChapter && (
                            <ChapterPOVEditor chapter={currentChapter} onClose={() => setOpenDrawer(null)} />
                        )}
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline">Close</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* Replace the Chapter Notes Drawer with this Sheet */}
            <Sheet open={openDrawer === "chapterNotes"} onOpenChange={open => !open && setOpenDrawer(null)}>
                <SheetContent side="right" className="h-[100vh] min-w-[800px]">
                    <SheetHeader>
                        <SheetTitle>Scribble</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto h-[100vh]">
                        {currentChapter && (
                            <ChapterNotesEditor
                                key={currentChapter.id}
                                chapter={currentChapter}
                                onClose={() => setOpenDrawer(null)}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
