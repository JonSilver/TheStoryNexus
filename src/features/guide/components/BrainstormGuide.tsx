import { BookOpen, Bot, Layers, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BrainstormGuide() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-4">Brainstorm Guide</h2>
                <p className="text-muted-foreground mb-6">
                    Learn how to use the brainstorming features to develop ideas, explore plot possibilities, and
                    overcome writer's block with AI-assisted conversations.
                </p>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold">What is Brainstorming?</h3>
                    <p>
                        The Brainstorm feature provides a chat-based interface for conversing with AI about your story.
                        Unlike Scene Beats which generate prose directly into your chapters, brainstorming helps you
                        explore ideas, develop characters, plan plot points, and work through creative challenges
                        through natural conversation.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Key Benefits
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Develop character backstories and motivations</li>
                                    <li>Explore plot alternatives and "what if" scenarios</li>
                                    <li>Work through plot holes and inconsistencies</li>
                                    <li>Generate world-building details on demand</li>
                                    <li>Overcome writer's block with AI suggestions</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Bot className="h-4 w-4 text-primary" />
                                    Context Awareness
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Access to your lorebook entries</li>
                                    <li>Chapter summaries for continuity</li>
                                    <li>Full chapter content when needed</li>
                                    <li>Chat history maintained across sessions</li>
                                    <li>Customisable context selection</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            1
                        </span>
                        Accessing Brainstorm
                    </h3>
                    <p>
                        Navigate to your story dashboard and click on the "Brainstorm" tab. You'll see a sidebar with
                        your chat sessions and a main area for conversation.
                    </p>
                    <p className="text-sm text-muted-foreground">Path: Dashboard → [Your Story] → Brainstorm</p>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            2
                        </span>
                        Creating a Chat Session
                    </h3>
                    <p>Each brainstorming session is a separate chat that maintains its own conversation history.</p>
                    <ol className="list-decimal list-inside space-y-2 ml-4">
                        <li>
                            Click the <strong>Create New Chat</strong> button
                        </li>
                        <li>A new chat appears in the sidebar with a timestamp</li>
                        <li>You can rename chats for better organisation</li>
                        <li>Create multiple chats for different aspects of your story</li>
                    </ol>
                    <Alert className="mt-3">
                        <AlertTitle>Organisation Tip</AlertTitle>
                        <AlertDescription>
                            Create separate chats for different purposes: "Character Development", "Plot Planning",
                            "World Building", etc. This helps you find relevant conversations later.
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            3
                        </span>
                        Selecting a Prompt and Model
                    </h3>
                    <p>Before starting a conversation, choose the AI prompt and model to use.</p>
                    <div className="space-y-3 ml-4">
                        <div>
                            <h4 className="font-medium text-sm">Prompt Selection:</h4>
                            <p className="text-sm text-muted-foreground">
                                Choose from system prompts or your custom brainstorm-type prompts. Different prompts can
                                be optimised for different tasks (character development, plot analysis, world-building,
                                etc.).
                            </p>
                        </div>
                        <div>
                            <h4 className="font-medium text-sm">Model Selection:</h4>
                            <p className="text-sm text-muted-foreground">
                                Select an AI model from your configured providers (OpenAI, OpenRouter, or Local).
                                Different models have different strengths—experiment to find what works best for your
                                brainstorming style.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            4
                        </span>
                        Using Context Controls
                    </h3>
                    <p>Control what context the AI has access to during your conversation.</p>
                    <div className="bg-muted p-4 rounded-md space-y-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Layers className="h-4 w-4 text-primary" />
                                <h4 className="font-medium text-sm">Full Context Mode</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Enable to automatically include all lorebook entries, chapter summaries, and relevant
                                story content. Great for general discussions where you want the AI to have complete
                                knowledge.
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <h4 className="font-medium text-sm">Selective Context Mode</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Manually choose specific lorebook entries, chapter summaries, or chapter content to
                                include. Useful when you want focused discussions about particular elements without
                                overwhelming the context window.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            5
                        </span>
                        Having the Conversation
                    </h3>
                    <p>Type your questions or prompts in the message input area and press Send or Enter.</p>
                    <div className="space-y-2 ml-4">
                        <h4 className="font-medium text-sm">Example Brainstorming Questions:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>"What would motivate my antagonist to change sides?"</li>
                            <li>"How can I make this plot twist more surprising?"</li>
                            <li>"Generate three possible backstories for this character"</li>
                            <li>"What are the logical consequences of this magical system?"</li>
                            <li>"How should I handle the pacing in the next chapter?"</li>
                        </ul>
                    </div>
                    <Alert className="mt-3 bg-primary/10 border-primary">
                        <AlertTitle>Pro Tip</AlertTitle>
                        <AlertDescription>
                            The AI maintains conversation history, so you can have multi-turn discussions. Ask follow-up
                            questions, request alternatives, or refine ideas through back-and-forth dialogue.
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            6
                        </span>
                        Managing Chat Sessions
                    </h3>
                    <p>Keep your brainstorming organised with these management features:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="border rounded-lg p-3 bg-card">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquarePlus className="h-4 w-4 text-primary" />
                                <h5 className="font-medium text-sm">Renaming Chats</h5>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Give your chats descriptive names to find them easily later
                            </p>
                        </div>
                        <div className="border rounded-lg p-3 bg-card">
                            <div className="flex items-center gap-2 mb-2">
                                <Trash2 className="h-4 w-4 text-primary" />
                                <h5 className="font-medium text-sm">Deleting Chats</h5>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Remove chats you no longer need to declutter your workspace
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 p-6 border rounded-lg bg-muted/30">
                    <h3 className="text-xl font-semibold mb-4">Effective Brainstorming Strategies</h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium mb-1">Be Specific</h4>
                            <p className="text-sm text-muted-foreground">
                                Instead of "Tell me about my character," try "What psychological trauma might explain
                                why my character avoids commitment?"
                            </p>
                        </div>
                        <div>
                            <h4 className="font-medium mb-1">Use Lorebook Context</h4>
                            <p className="text-sm text-muted-foreground">
                                Enable full context or select relevant lorebook entries so the AI understands your
                                story's world and characters.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-medium mb-1">Iterate and Refine</h4>
                            <p className="text-sm text-muted-foreground">
                                Don't settle for the first response. Ask for variations, alternatives, or deeper
                                exploration of promising ideas.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-medium mb-1">Record Good Ideas in Lorebook</h4>
                            <p className="text-sm text-muted-foreground">
                                When brainstorming produces valuable insights, add them to your lorebook so they inform
                                future AI generations.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
