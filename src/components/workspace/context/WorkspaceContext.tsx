import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY_PREFIX = "storyNexus.sidebar";
const STORAGE_KEY_LEFT = `${STORAGE_KEY_PREFIX}.left.collapsed`;
const STORAGE_KEY_RIGHT = `${STORAGE_KEY_PREFIX}.right.collapsed`;

interface SidebarState {
    collapsed: boolean;
    previousCollapsed: boolean;
}

interface WorkspaceContextType {
    leftSidebar: SidebarState;
    rightSidebar: SidebarState;
    isMaximised: boolean;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleMaximise: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const initSidebar = (key: string): SidebarState => {
    const collapsed = localStorage.getItem(key) === "true";
    return { collapsed, previousCollapsed: collapsed };
};

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
    const [leftSidebar, setLeftSidebar] = useState<SidebarState>(() => initSidebar(STORAGE_KEY_LEFT));
    const [rightSidebar, setRightSidebar] = useState<SidebarState>(() => initSidebar(STORAGE_KEY_RIGHT));
    const [isMaximised, setIsMaximised] = useState(false);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_LEFT, String(leftSidebar.collapsed));
    }, [leftSidebar.collapsed]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_RIGHT, String(rightSidebar.collapsed));
    }, [rightSidebar.collapsed]);

    const toggleLeftSidebar = useCallback(() => {
        if (!isMaximised) setLeftSidebar(s => ({ collapsed: !s.collapsed, previousCollapsed: !s.collapsed }));
    }, [isMaximised]);

    const toggleRightSidebar = useCallback(() => {
        if (!isMaximised) setRightSidebar(s => ({ collapsed: !s.collapsed, previousCollapsed: !s.collapsed }));
    }, [isMaximised]);

    const toggleMaximise = useCallback(() => {
        setIsMaximised(prev => {
            const entering = !prev;
            const update = (s: SidebarState): SidebarState =>
                entering ? { ...s, collapsed: true } : { ...s, collapsed: s.previousCollapsed };
            setLeftSidebar(update);
            setRightSidebar(update);
            return entering;
        });
    }, []);

    return (
        <WorkspaceContext.Provider
            value={{
                leftSidebar,
                rightSidebar,
                isMaximised,
                toggleLeftSidebar,
                toggleRightSidebar,
                toggleMaximise
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
    return context;
};
