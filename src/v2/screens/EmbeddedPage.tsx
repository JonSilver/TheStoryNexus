import { Loader2 } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { ScreenHeader } from "../components/ScreenParts";

/**
 * Hosts a full page inside the v2 shell: back header + scrolling body, with
 * the bottom nav still present. No screen the app links to may strand the
 * writer outside the shell.
 */
export const EmbeddedPage = ({
    title,
    onBack,
    children
}: {
    title: string;
    onBack: () => void;
    children: ReactNode;
}) => (
    <div className="flex h-full flex-col">
        <ScreenHeader title={title} onBack={onBack} />
        <div className="min-h-0 flex-1 overflow-y-auto">
            <Suspense
                fallback={
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                }
            >
                {children}
            </Suspense>
        </div>
    </div>
);
