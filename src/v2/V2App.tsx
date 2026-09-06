import { BookOpen, Library, MoreHorizontal, PenLine } from "lucide-react";
import { useState } from "react";
import { ActionsScreen } from "./screens/ActionsScreen";
import { BibleScreen } from "./screens/BibleScreen";
import { BrainstormScreen } from "./screens/BrainstormScreen";
import { ChaptersScreen } from "./screens/ChaptersScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { NotesScreen } from "./screens/NotesScreen";
import { StoriesScreen } from "./screens/StoriesScreen";
import { WriteScreen } from "./screens/WriteScreen";

const TOOLS = [
    { id: "write", label: "Write", icon: PenLine, Screen: WriteScreen },
    { id: "chapters", label: "Chapters", icon: BookOpen, Screen: ChaptersScreen },
    { id: "stories", label: "Stories", icon: Library, Screen: StoriesScreen },
    { id: "more", label: "More", icon: MoreHorizontal, Screen: MoreScreen }
] as const;

export type V2Tool = (typeof TOOLS)[number]["id"] | "bible" | "actions" | "notes" | "brainstorm";

export default function V2App() {
    const [tool, setTool] = useState<V2Tool>("write");
    const active = TOOLS.find(t => t.id === tool) ?? TOOLS[0];

    return (
        <div className="flex h-dvh flex-col bg-background text-foreground">
            <main className="min-h-0 flex-1">
                {tool === "bible" ? (
                    <BibleScreen goTo={setTool} />
                ) : tool === "actions" ? (
                    <ActionsScreen goTo={setTool} />
                ) : tool === "notes" ? (
                    <NotesScreen goTo={setTool} />
                ) : tool === "brainstorm" ? (
                    <BrainstormScreen goTo={setTool} />
                ) : (
                    <active.Screen goTo={setTool} />
                )}
            </main>
            <nav className="flex shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
                {TOOLS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTool(id)}
                        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                            tool === id ? "text-primary" : "text-muted-foreground"
                        }`}
                        aria-current={tool === id ? "page" : undefined}
                    >
                        <Icon className="h-5 w-5" />
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

export interface ScreenProps {
    goTo: (tool: V2Tool) => void;
}
