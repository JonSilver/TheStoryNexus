import { BookOpen, Bot, ExternalLink, PenLine, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { API_URLS } from "@/constants/urls";

export default function BasicsGuide() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-4">The Absolute Basics</h2>
                <p className="text-muted-foreground mb-6">
                    Welcome to The Story Nexus! This guide will walk you through the essential steps to get started with
                    your AI-powered writing journey.
                </p>
            </div>

            <Alert className="bg-primary/10 border-primary">
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Quick Start (5 Minutes)</AlertTitle>
                <AlertDescription>
                    <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                        <li>Go to AI Settings → Add an API key (OpenAI, OpenRouter, or Local API URL)</li>
                        <li>Go to Stories → Create New Story → Enter title, author, language</li>
                        <li>Click the story card → Create New Chapter → Enter chapter title</li>
                        <li>Click "Write" button → Start typing or press Alt+S (Option+S on Mac) for AI assistance</li>
                        <li>That's it! Read the detailed guide below for advanced features.</li>
                    </ol>
                </AlertDescription>
            </Alert>

            <div className="space-y-6">
                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            1
                        </span>
                        Set Up Your AI Connection
                    </h3>
                    <p>
                        Before you can use AI features, you'll need to connect to an AI provider. The Story Nexus
                        supports OpenAI, OpenRouter, or a local AI model.
                    </p>
                    <div className="flex items-center gap-2 my-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <Link to="/ai-settings">
                            <Button variant="outline" className="gap-1">
                                Go to AI Settings
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="border rounded-lg p-4 bg-card">
                            <h4 className="font-medium mb-2">OpenRouter</h4>
                            <p className="text-sm text-muted-foreground">
                                Enter your OpenRouter API key to access a variety of models from different providers.
                            </p>
                        </div>
                        <div className="border rounded-lg p-4 bg-card">
                            <h4 className="font-medium mb-2">OpenAI</h4>
                            <p className="text-sm text-muted-foreground">
                                Enter your OpenAI API key to access models like GPT-4 and GPT-3.5.
                            </p>
                        </div>
                        <div className="border rounded-lg p-4 bg-card">
                            <h4 className="font-medium mb-2">Local</h4>
                            <p className="text-sm text-muted-foreground">
                                Connect to a locally hosted model by entering the API URL (default:{" "}
                                {API_URLS.LOCAL_AI_DEFAULT}).
                            </p>
                        </div>
                    </div>
                    <Alert>
                        <AlertTitle>Important</AlertTitle>
                        <AlertDescription>
                            After adding your API key, available models will be automatically retrieved. For local
                            models, you'll need to click the "Refresh Models" button.
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            2
                        </span>
                        Understand Series vs Stories
                    </h3>
                    <p>The Story Nexus supports two ways to organise your writing:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="border rounded-lg p-4 bg-card">
                            <h4 className="font-medium mb-2">Standalone Stories</h4>
                            <p className="text-sm text-muted-foreground">
                                Individual stories that aren't connected to others. Perfect for one-off projects, short
                                stories, or independent novels.
                            </p>
                        </div>
                        <div className="border rounded-lg p-4 bg-card">
                            <h4 className="font-medium mb-2">Series</h4>
                            <p className="text-sm text-muted-foreground">
                                Collections of related stories that share a world, characters, or timeline. Ideal for
                                sequels, prequels, or interconnected narratives.
                            </p>
                        </div>
                    </div>
                    <Alert>
                        <AlertTitle>Tip</AlertTitle>
                        <AlertDescription>
                            Series are optional. You can create standalone stories directly, or group related stories
                            into a series later. Stories in a series share lorebook entries automatically.
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            3
                        </span>
                        Create Your First Story
                    </h3>
                    <p>Once your AI connection is set up, you can create your first story.</p>
                    <ol className="list-decimal list-inside space-y-2 ml-4">
                        <li>
                            From the Home page, choose either <strong>Stories</strong> (for standalone) or{" "}
                            <strong>Series</strong> (to create a series first)
                        </li>
                        <li>
                            For standalone: Click <strong>Create New Story</strong>, enter title, author, language, and
                            synopsis
                        </li>
                        <li>For series: Create a series first, then add stories to it from the series dashboard</li>
                        <li>Click on the story card to access your story dashboard</li>
                    </ol>
                    <div className="flex items-center gap-4 my-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <Link to="/stories">
                            <Button variant="outline" className="gap-1">
                                Go to Stories
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </Link>
                        <Link to="/series">
                            <Button variant="outline" className="gap-1">
                                Go to Series
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            4
                        </span>
                        Create Your First Chapter
                    </h3>
                    <p>Now that you have a story, it's time to create your first chapter.</p>
                    <ol className="list-decimal list-inside space-y-2 ml-4">
                        <li>
                            From your story dashboard, click <strong>Create New Chapter</strong>
                        </li>
                        <li>Enter a title for your chapter</li>
                        <li>Optionally, set a POV (Point of View) character and type</li>
                        <li>
                            Click <strong>Create</strong> to save your new chapter
                        </li>
                        <li>
                            Click the <strong>Write</strong> button on the chapter card to open the editor
                        </li>
                    </ol>
                    <div className="flex items-center gap-2 my-2">
                        <PenLine className="h-5 w-5 text-primary" />
                    </div>
                </div>

                <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                            5
                        </span>
                        Write with AI Assistance
                    </h3>
                    <p>
                        The Story Nexus editor allows you to write manually or with AI assistance through Scene Beats.
                    </p>
                    <div className="bg-muted p-4 rounded-md">
                        <h4 className="font-medium mb-2">Using Scene Beats</h4>
                        <p className="mb-2">
                            Scene Beats are commands you give to the AI to generate content based on your instructions.
                        </p>
                        <ol className="list-decimal list-inside space-y-2 ml-4">
                            <li>
                                Press <kbd className="px-2 py-1 bg-background rounded border">Alt + S</kbd> (Windows) or{" "}
                                <kbd className="px-2 py-1 bg-background rounded border">Option + S</kbd> (Mac) to insert
                                a Scene Beat
                                <br />
                                <span className="text-sm text-muted-foreground">
                                    Alternatively, click on the menu and select Insert → Scene Beat
                                </span>
                            </li>
                            <li>
                                Enter your command describing what you want the AI to write (e.g., "A tense
                                confrontation between the detective and suspect")
                            </li>
                            <li>Select a prompt template from the dropdown (scene beat prompts work best)</li>
                            <li>Select an AI model from your configured providers</li>
                            <li>
                                Choose a <strong>context mode</strong> (controls which lorebook entries the AI sees):
                                <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-sm">
                                    <li>
                                        <strong>Use Matched Chapter</strong> (default) - Includes lorebook entries that
                                        match text in your current chapter
                                    </li>
                                    <li>
                                        <strong>Use Matched Scene Beat</strong> - Includes entries that match words in
                                        your scene beat command
                                    </li>
                                    <li>
                                        <strong>Use Custom Context</strong> - Manually select which lorebook entries to
                                        include
                                    </li>
                                </ul>
                            </li>
                            <li>
                                The <strong>Generate Prose</strong> button becomes active once you've entered a command,
                                selected a prompt, and selected a model
                            </li>
                            <li>
                                Click <strong>Generate Prose</strong> and wait for the AI to create content (streaming
                                will show progress)
                            </li>
                            <li>
                                Review the generated content and click <strong>Accept</strong> to insert it into your
                                story, or <strong>Regenerate</strong> to try again with the same settings
                            </li>
                        </ol>
                    </div>
                    <div className="flex items-center gap-2 my-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <Alert className="bg-primary/10 border-primary">
                        <AlertTitle>Editor Tips</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside space-y-1">
                                <li>
                                    Be specific in Scene Beat commands: Instead of "continue the story," try "describe
                                    the character's reaction to the surprising news, showing their inner conflict"
                                </li>
                                <li>
                                    <strong>@ Autocomplete:</strong> Type{" "}
                                    <kbd className="px-1 py-0.5 bg-background rounded border text-xs">@</kbd> in the
                                    editor to trigger lorebook tag autocomplete. Select a tag to quickly reference
                                    lorebook entries
                                </li>
                                <li>
                                    <strong>Word Count:</strong> Real-time word count displays automatically as you
                                    write
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="mt-8 p-6 border rounded-lg bg-muted/30">
                    <h3 className="text-xl font-semibold mb-4">What's Next?</h3>
                    <p className="mb-4">
                        These are just the basics to get you started. The Story Nexus offers many more advanced features
                        to enhance your writing experience:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>
                            Create a <strong>Lorebook</strong> with hierarchical levels (global, series, story) to
                            manage characters, locations, and other story elements
                        </li>
                        <li>
                            Customize <strong>Prompts</strong> to tailor the AI's writing style and behaviour
                        </li>
                        <li>
                            Use <strong>Brainstorming</strong> tools to develop ideas and overcome writer's block
                        </li>
                        <li>
                            Organise related stories into <strong>Series</strong> with shared world-building
                        </li>
                    </ul>
                    <p className="mt-4">Explore the other guides to learn more about these advanced features.</p>
                </div>
            </div>
        </div>
    );
}
