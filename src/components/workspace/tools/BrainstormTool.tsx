import { AlertCircle, MessageSquarePlus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ChatInterface from "@/features/brainstorm/components/ChatInterface";
import ChatList from "@/features/brainstorm/components/ChatList";
import { useCreateBrainstormMutation } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { LorebookProvider } from "@/features/lorebook/context/LorebookContext";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import type { AIChat } from "@/types/story";
import { randomUUID } from "@/utils/crypto";

const ChatErrorFallback = (error: Error, resetError: () => void) => (
    <div className="flex items-center justify-center h-full p-4">
        <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Chat Error</AlertTitle>
            <AlertDescription className="mt-2">
                <p className="mb-4">The chat interface encountered an error: {error.message}</p>
                <div className="flex gap-2">
                    <Button onClick={resetError} variant="outline" size="sm">
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Reset Chat
                    </Button>
                    <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                        Reload Page
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    </div>
);

export const BrainstormTool = () => {
    const { currentStoryId } = useStoryContext();
    const [selectedChat, setSelectedChat] = useState<AIChat | null>(null);
    const createMutation = useCreateBrainstormMutation();

    if (!currentStoryId) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No story selected</p>
            </div>
        );
    }

    const handleCreateNewChat = () => {
        createMutation.mutate(
            {
                id: randomUUID(),
                storyId: currentStoryId,
                title: `New Chat ${new Date().toLocaleString()}`,
                messages: [],
                updatedAt: new Date()
            },
            {
                onSuccess: newChat => {
                    setSelectedChat(newChat);
                }
            }
        );
    };

    return (
        <LorebookProvider storyId={currentStoryId}>
            <div className="flex h-full">
                <ChatList storyId={currentStoryId} selectedChat={selectedChat} onSelectChat={setSelectedChat} />
                <div className="flex-1 h-full">
                    {selectedChat ? (
                        <ErrorBoundary fallback={ChatErrorFallback} resetKeys={[selectedChat.id]}>
                            <ChatInterface
                                storyId={currentStoryId}
                                selectedChat={selectedChat}
                                onChatUpdate={setSelectedChat}
                            />
                        </ErrorBoundary>
                    ) : (
                        <div className="flex items-center justify-center h-full flex-col gap-6 text-muted-foreground p-4">
                            <MessageSquarePlus className="h-16 w-16 text-muted-foreground/50" />
                            <div className="text-center max-w-md">
                                <h3 className="text-xl font-semibold mb-2">No Chat Selected</h3>
                                <p className="mb-6">
                                    Select an existing chat from the sidebar or create a new one to start brainstorming
                                    ideas for your story.
                                </p>
                                <Button onClick={handleCreateNewChat} className="flex items-center gap-2">
                                    <MessageSquarePlus className="h-4 w-4" />
                                    Create New Chat
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </LorebookProvider>
    );
};
