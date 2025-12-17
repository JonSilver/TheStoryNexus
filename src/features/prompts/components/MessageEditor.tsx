import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { usePromptMessages } from "../hooks/usePromptMessages";

type MessageRole = "system" | "user" | "assistant";

const MESSAGE_ROLES: MessageRole[] = ["system", "user", "assistant"];

interface MessageEditorProps {
    messageHandlers: ReturnType<typeof usePromptMessages>;
}

const AddMessageButton = ({ role, onClick }: { role: MessageRole; onClick: () => void }) => (
    <Button type="button" variant="outline" onClick={onClick} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
    </Button>
);

export const MessageEditor = ({ messageHandlers }: MessageEditorProps) => {
    const { messages, addMessage, updateMessage, removeMessage, moveMessage } = messageHandlers;

    return (
        <>
            <div className="space-y-4">
                {messages.map((message, index) => (
                    <div key={message._id} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                            <Select
                                value={message.role}
                                onValueChange={(value: MessageRole) => updateMessage(index, { role: value })}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">System</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="assistant">Assistant</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveMessage(index, "up")}
                                    disabled={index === 0}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveMessage(index, "down")}
                                    disabled={index === messages.length - 1}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeMessage(index)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <Textarea
                            value={message.content}
                            onChange={e => updateMessage(index, { content: e.target.value })}
                            placeholder={`Enter ${message.role} message...`}
                            className="min-h-[200px] font-mono"
                        />
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                {MESSAGE_ROLES.map(role => (
                    <AddMessageButton key={role} role={role} onClick={() => addMessage(role)} />
                ))}
            </div>
        </>
    );
};
