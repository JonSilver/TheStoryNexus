import { Maximize2, Minimize2, RefreshCw } from "lucide-react";

/** The one-tap actions on selected prose, wherever they're offered (toolbar, context menu). */
export const SELECTION_ACTIONS = [
    { actionId: "rework", label: "Rework", icon: RefreshCw },
    { actionId: "expand", label: "Expand", icon: Maximize2 },
    { actionId: "shorten", label: "Shorten", icon: Minimize2 }
] as const;

export type SelectionActionId = (typeof SELECTION_ACTIONS)[number]["actionId"];
