import { AlertCircle, Check, ChevronsUpDown, MessageSquarePlus, Plus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ChatInterface from "@/features/brainstorm/components/ChatInterface";
import ChatList from "@/features/brainstorm/components/ChatList";
import { useBrainstormByStoryQuery, useCreateBrainstormMutation } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { LorebookProvider } from "@/features/lorebook/context/LorebookContext";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { cn } from "@/lib/utils";
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
    const [mobileOpen, setMobileOpen] = useState(false);
    const createMutation = useCreateBrainstormMutation();
    const { data: chats = [] } = useBrainstormByStoryQuery(currentStoryId || "");

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
                    setMobileOpen(false);
                }
            }
        );
    };

    return (
        <LorebookProvider storyId={currentStoryId}>
            <div className="flex flex-col md:flex-row h-full">
                {/* Mobile: dropdown chat selector */}
                <div className="md:hidden p-2 border-b flex gap-2">
                    <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={mobileOpen}
                                aria-controls="chats-listbox"
                                className="flex-1 justify-between"
                            >
                                <span className="truncate">{selectedChat ? selectedChat.title : "Select chat..."}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[calc(100vw-2rem)] p-0" align="start">
                            <Command id="chats-listbox">
                                <CommandInput placeholder="Search chats..." />
                                <CommandList>
                                    <CommandEmpty>No chats found.</CommandEmpty>
                                    <CommandGroup>
                                        {chats.map(chat => (
                                            <CommandItem
                                                key={chat.id}
                                                value={chat.title}
                                                onSelect={() => {
                                                    setSelectedChat(chat);
                                                    setMobileOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedChat?.id === chat.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <span className="truncate">{chat.title}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <Button size="icon" onClick={handleCreateNewChat} title="New Chat">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                {/* Desktop: sidebar */}
                <div className="hidden md:block">
                    <ChatList storyId={currentStoryId} selectedChat={selectedChat} onSelectChat={setSelectedChat} />
                </div>

                <div className="flex-1 h-full min-h-0">
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
                            <MessageSquarePlus className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/50" />
                            <div className="text-center max-w-md">
                                <h3 className="text-lg md:text-xl font-semibold mb-2">No Chat Selected</h3>
                                <p className="mb-6 text-sm md:text-base">
                                    Select a chat or create a new one to start brainstorming.
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
