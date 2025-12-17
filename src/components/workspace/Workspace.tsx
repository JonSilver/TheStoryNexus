import { useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { MainContent } from "./MainContent";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { useWorkspaceShortcuts } from "./hooks/useWorkspaceShortcuts";

const WorkspaceContent = () => {
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    useWorkspaceShortcuts({
        onOpenCommandPalette: () => setCommandPaletteOpen(true)
    });

    return (
        <div className="h-screen flex bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <TopBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
                <main className="flex-1 overflow-auto pb-16 md:pb-0">
                    <MainContent />
                </main>
            </div>
            <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        </div>
    );
};

export const Workspace = () => (
    <WorkspaceProvider>
        <WorkspaceContent />
    </WorkspaceProvider>
);
