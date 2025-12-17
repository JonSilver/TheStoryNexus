import {
    AlertCircle,
    BookOpen,
    CheckCircle,
    ChevronDown,
    FolderTree,
    GripVertical,
    Layers,
    Link as LinkIcon,
    Pencil,
    Trash2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdvancedGuide() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-4">Advanced Features Guide</h2>
                <p className="text-muted-foreground mb-6">
                    Master advanced features including series management, hierarchical lorebooks, and workflow
                    optimisation to take your writing to the next level.
                </p>
            </div>

            <Tabs defaultValue="series" className="w-full">
                <TabsList className="grid grid-cols-5 mb-8">
                    <TabsTrigger value="series">Series</TabsTrigger>
                    <TabsTrigger value="content">Content Management</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow & Shortcuts</TabsTrigger>
                    <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
                    <TabsTrigger value="future">Future Topics</TabsTrigger>
                </TabsList>

                <TabsContent value="series" className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Working with Series</h3>
                        <p>
                            Series provide a powerful way to organise interconnected stories that share world-building,
                            characters, or timelines. Understanding when and how to use series effectively can
                            significantly improve your writing workflow.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        When to Use Series
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        <li>Multiple books in the same universe</li>
                                        <li>Sequels, prequels, or spin-offs</li>
                                        <li>Shared world with different protagonists</li>
                                        <li>Anthology stories with common elements</li>
                                        <li>Stories spanning a connected timeline</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <CheckCircle className="h-4 w-4 text-blue-500" />
                                        Benefits of Series
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        <li>Shared lorebook entries across all stories</li>
                                        <li>Consistent world-building automatically</li>
                                        <li>Organised dashboard for related works</li>
                                        <li>Easy navigation between connected stories</li>
                                        <li>Unified character and location management</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Creating and Managing Series</h3>
                        <div className="space-y-3">
                            <div>
                                <h4 className="font-medium text-sm mb-1">1. Creating a Series</h4>
                                <p className="text-sm text-muted-foreground ml-4">
                                    Navigate to the Series page from the home screen. Click "Create New Series" and
                                    provide a name and optional description. The description helps you remember what
                                    connects the stories in this series.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-medium text-sm mb-1">2. Adding Stories to a Series</h4>
                                <p className="text-sm text-muted-foreground ml-4">
                                    From the series dashboard, click "Create New Story". Stories created this way
                                    automatically belong to the series. You can also assign existing standalone stories
                                    to a series by editing the story's details.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-medium text-sm mb-1">3. Accessing Series Lorebook</h4>
                                <p className="text-sm text-muted-foreground ml-4">
                                    The series dashboard includes a Lorebook tab. Entries created at the series level
                                    are accessible to all stories in the series, perfect for recurring characters,
                                    shared locations, or universal world rules.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Series Lorebook Strategy</h3>
                        <p>
                            Deciding what goes in the series lorebook versus individual story lorebooks is crucial for
                            effective organisation.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                            <div className="border rounded-lg p-4 bg-card">
                                <div className="flex items-center gap-2 mb-2">
                                    <FolderTree className="h-4 w-4 text-primary" />
                                    <h5 className="font-medium text-sm">Global Level</h5>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">Use for:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                    <li>Writing style guides</li>
                                    <li>Universal themes</li>
                                    <li>Cross-series concepts</li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <div className="flex items-center gap-2 mb-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <h5 className="font-medium text-sm">Series Level</h5>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">Use for:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                    <li>Recurring characters</li>
                                    <li>Shared locations</li>
                                    <li>Series-wide timeline</li>
                                    <li>Common lore/magic</li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <div className="flex items-center gap-2 mb-2">
                                    <BookOpen className="h-4 w-4 text-primary" />
                                    <h5 className="font-medium text-sm">Story Level</h5>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">Use for:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                    <li>Story-unique characters</li>
                                    <li>Specific plot locations</li>
                                    <li>One-off items/events</li>
                                    <li>Story-specific notes</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 p-6 border rounded-lg bg-muted/30">
                        <h3 className="text-xl font-semibold mb-4">Series Best Practices</h3>
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-sm">Plan Your Hierarchy Early</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Before creating multiple stories, decide what elements should be shared
                                            across the series. Moving entries between levels later is possible but
                                            planning prevents reorganisation work.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-sm">Use Consistent Naming</h4>
                                        <p className="text-sm text-muted-foreground">
                                            If a character appears across multiple stories, use the same tags and naming
                                            in series-level entries. This ensures the AI recognises them consistently.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-sm">
                                            Update Series Entries as Stories Progress
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            When characters develop or world elements evolve across stories, update the
                                            series lorebook entries to reflect the current state. This keeps AI context
                                            accurate across all stories.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-sm">Consider Chronological Order</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Even if you're not writing in chronological order, note the timeline in
                                            series lorebook entries. This helps maintain continuity when jumping between
                                            different points in your story universe.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Alert className="mt-6">
                        <LinkIcon className="h-4 w-4" />
                        <AlertTitle>Converting Standalone Stories to Series</AlertTitle>
                        <AlertDescription>
                            If you start with a standalone story and later decide to create a series, simply create the
                            series and edit your story to assign it to the series. Any story-level lorebook entries
                            remain at the story level—you can manually promote shared elements to the series level as
                            needed.
                        </AlertDescription>
                    </Alert>
                </TabsContent>

                <TabsContent value="content" className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Managing Your Content</h3>
                        <p>
                            Master the tools for managing stories, chapters, and notes to keep your writing organised
                            and accessible.
                        </p>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Chapter Management</h3>
                        <p className="text-sm">
                            Chapters can be managed from the Chapters page in your story dashboard.
                        </p>

                        <div className="space-y-4 mt-4">
                            <div>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-primary" />
                                    Reordering Chapters
                                </h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    Drag and drop chapters by the grip handle (six dots) on the left side of each
                                    chapter card. The order updates automatically and affects chapter numbering and
                                    summary context.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-primary" />
                                    Editing Chapter Details
                                </h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    Click the edit icon on a chapter card to modify:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-12 mt-1">
                                    <li>
                                        <strong>Title:</strong> Change the chapter title
                                    </li>
                                    <li>
                                        <strong>POV Type:</strong> First Person, Third Person Limited, or Third Person
                                        Omniscient
                                    </li>
                                    <li>
                                        <strong>POV Character:</strong> Select from your lorebook characters (disabled
                                        for Omniscient POV)
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                    <ChevronDown className="h-4 w-4 text-primary" />
                                    Viewing & Editing Summaries
                                </h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    Click the expand arrow on a chapter card to view its summary. You can:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-12 mt-1">
                                    <li>Edit the summary directly in the textarea</li>
                                    <li>
                                        Generate a new summary using the AI (select a "Generate Summary" prompt and
                                        model)
                                    </li>
                                    <li>Export the chapter to various formats using the download menu</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    Deleting Chapters
                                </h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    Click the delete icon on a chapter card. You'll be asked to confirm.{" "}
                                    <strong className="text-destructive">
                                        Deletion is permanent and cannot be undone.
                                    </strong>{" "}
                                    All chapter content, notes, outlines, and scene beats are deleted.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm mb-2">Chapter Notes & Outlines</h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    Access notes and outlines from within the chapter editor:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-12 mt-1">
                                    <li>
                                        <strong>Outline:</strong> Plan your chapter structure, scene beats, and plot
                                        points before writing
                                    </li>
                                    <li>
                                        <strong>Notes:</strong> Track character arcs, continuity reminders, or revision
                                        notes for this specific chapter
                                    </li>
                                    <li>
                                        Both persist automatically and are accessible from the editor sidebar or toolbar
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Story Management</h3>
                        <p className="text-sm">Manage story metadata and settings from the Stories page.</p>

                        <div className="space-y-4 mt-4">
                            <div>
                                <h4 className="font-medium text-sm mb-2">Editing Story Details</h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    From the Stories page, click the edit icon on a story card to modify:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-12 mt-1">
                                    <li>
                                        <strong>Title:</strong> Story title
                                    </li>
                                    <li>
                                        <strong>Author:</strong> Author name
                                    </li>
                                    <li>
                                        <strong>Language:</strong> Primary story language (used in AI prompts)
                                    </li>
                                    <li>
                                        <strong>Synopsis:</strong> Brief story description or summary
                                    </li>
                                    <li>
                                        <strong>Series:</strong> Assign to a series or change series assignment (leave
                                        blank for standalone)
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm mb-2">Converting Standalone to Series Story</h4>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                                    <li>Create a series from the Series page if you haven't already</li>
                                    <li>Edit your standalone story details</li>
                                    <li>Select the series from the "Series" dropdown</li>
                                    <li>Save changes</li>
                                    <li>Your story now has access to series-level lorebook entries</li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    Deleting Stories
                                </h4>
                                <p className="text-sm text-muted-foreground ml-6">
                                    Click the delete icon on a story card and confirm.{" "}
                                    <strong className="text-destructive">
                                        This permanently deletes the story and all its chapters, prompts, lorebook
                                        entries, notes, brainstorm chats, and scene beats.
                                    </strong>{" "}
                                    Consider exporting before deletion if you want to keep a backup.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Notes Feature</h3>
                        <p className="text-sm">
                            The Notes feature provides story-level note-taking separate from chapter notes. Access it
                            from the "Notes" tab in your story dashboard.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">When to Use Notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        <li>Story-wide ideas and brainstorming</li>
                                        <li>Research and reference material</li>
                                        <li>Todo lists for revision or editing</li>
                                        <li>General notes not tied to specific chapters</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Note Types</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        <li>
                                            <strong>Idea:</strong> Plot ideas, character concepts
                                        </li>
                                        <li>
                                            <strong>Research:</strong> Background research, references
                                        </li>
                                        <li>
                                            <strong>Todo:</strong> Tasks, revisions, editing notes
                                        </li>
                                        <li>
                                            <strong>Other:</strong> Anything else
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="mt-4">
                            <h4 className="font-medium text-sm mb-2">Using Notes</h4>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-6">
                                <li>Navigate to Dashboard → [Your Story] → Notes</li>
                                <li>Click "Create New Note" in the sidebar</li>
                                <li>Enter a title and select a note type</li>
                                <li>Write your note content in the editor</li>
                                <li>Notes save automatically</li>
                                <li>Click on notes in the sidebar to switch between them</li>
                                <li>Delete notes using the delete button when a note is selected</li>
                            </ol>
                        </div>

                        <Alert className="mt-4">
                            <AlertTitle>Notes vs Chapter Notes vs Lorebook</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>
                                        <strong>Story Notes:</strong> General story-wide information, not tied to
                                        chapters
                                    </li>
                                    <li>
                                        <strong>Chapter Notes:</strong> Specific to one chapter, accessed from chapter
                                        editor
                                    </li>
                                    <li>
                                        <strong>Lorebook Notes Category:</strong> Story elements visible to AI during
                                        generation
                                    </li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </div>
                </TabsContent>

                <TabsContent value="workflow" className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Optimising Your Writing Workflow</h3>
                        <p>
                            Effective workflow habits help you make the most of The Story Nexus's features and maintain
                            creative momentum.
                        </p>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Lorebook-First Approach</h3>
                        <p className="text-sm">
                            Before diving into writing, spend time building your lorebook. This upfront investment pays
                            dividends when the AI has rich context from the start.
                        </p>
                        <div className="bg-muted p-4 rounded-md mt-2">
                            <h4 className="font-medium text-sm mb-2">Recommended Workflow:</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                <li>Create core character entries with personality, background, and goals</li>
                                <li>Define key locations with atmospheric details</li>
                                <li>Document your magic system, technology, or unique world rules</li>
                                <li>Add timeline entries for major historical events</li>
                                <li>Begin writing with confidence that the AI understands your world</li>
                            </ol>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Chapter Planning with Notes and Outlines</h3>
                        <p className="text-sm">
                            Each chapter supports both notes and outlines. Use them to stay organised:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div className="border rounded-lg p-3 bg-card">
                                <h4 className="font-medium text-sm mb-1">Chapter Outlines</h4>
                                <p className="text-xs text-muted-foreground">
                                    Plan scene beats, plot points, and structure before writing. Refer back as you write
                                    to stay on track.
                                </p>
                            </div>
                            <div className="border rounded-lg p-3 bg-card">
                                <h4 className="font-medium text-sm mb-1">Chapter Notes</h4>
                                <p className="text-xs text-muted-foreground">
                                    Track character arcs, continuity details, or revision reminders. Notes persist
                                    alongside your chapter.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Using Brainstorming Effectively</h3>
                        <p className="text-sm">
                            Don't wait until you're stuck to brainstorm. Proactive brainstorming prevents writer's
                            block:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                            <li>Brainstorm upcoming plot points before reaching them</li>
                            <li>Explore character motivations when planning scenes</li>
                            <li>Test "what if" scenarios to find the most compelling direction</li>
                            <li>Use brainstorming to work through logic issues in your plot</li>
                        </ul>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2">
                        <h3 className="text-lg font-medium">Summary Generation Strategy</h3>
                        <p className="text-sm">
                            Chapter summaries help the AI maintain continuity across your story. Generate summaries
                            after completing each chapter:
                        </p>
                        <div className="bg-muted p-4 rounded-md mt-2">
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                <li>Write your chapter to completion</li>
                                <li>Use a "Generate Summary" prompt to create a concise summary</li>
                                <li>Review and edit the summary to emphasise key plot points</li>
                                <li>Save the summary—it automatically becomes context for future chapters</li>
                            </ol>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-primary pl-4 py-2 mt-6">
                        <h3 className="text-lg font-medium">Keyboard Shortcuts Reference</h3>
                        <p className="text-sm">Master these shortcuts to speed up your writing workflow.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Editor Shortcuts</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Insert Scene Beat</span>
                                            <kbd className="px-2 py-1 bg-muted rounded border text-xs">
                                                Alt+S / Opt+S
                                            </kbd>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Trigger @ Autocomplete</span>
                                            <kbd className="px-2 py-1 bg-muted rounded border text-xs">@</kbd>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Save Chapter</span>
                                            <kbd className="px-2 py-1 bg-muted rounded border text-xs">Auto-save</kbd>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Navigation Tips</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        <li>Use browser back/forward for navigation</li>
                                        <li>Story dashboard tabs accessible via mouse</li>
                                        <li>Most features keyboard-accessible via Tab key</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="troubleshooting" className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Troubleshooting Common Issues</h3>
                        <p>Solutions to common problems you might encounter while using The Story Nexus.</p>
                    </div>

                    <div className="space-y-4 border-l-4 border-destructive pl-4 py-2">
                        <h3 className="text-lg font-medium">AI Generation Issues</h3>

                        <div className="space-y-3">
                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Models Don't Appear After Adding API Key</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    <strong>For OpenAI/OpenRouter:</strong>
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>Wait a few seconds - models fetch automatically after key is saved</li>
                                    <li>Check that your API key is valid (test it at the provider's website)</li>
                                    <li>Ensure you have internet connectivity</li>
                                    <li>Try refreshing the page</li>
                                </ul>
                                <p className="text-sm text-muted-foreground mt-2 mb-2">
                                    <strong>For Local Models:</strong>
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>Ensure LM Studio (or your local AI server) is running</li>
                                    <li>Check the API URL is correct (default: http://localhost:1234/v1)</li>
                                    <li>Click the "Refresh Models" button after starting your local server</li>
                                    <li>Verify a model is loaded in LM Studio</li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Scene Beat Won't Generate</h4>
                                <p className="text-sm text-muted-foreground mb-2">Check these requirements:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>You've entered a scene beat command</li>
                                    <li>You've selected a prompt from the dropdown</li>
                                    <li>You've selected a model from the dropdown</li>
                                    <li>The "Generate Prose" button should become active when all three are set</li>
                                    <li>If using a local model, ensure your server is running and responsive</li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Generation Fails or Returns Error</h4>
                                <p className="text-sm text-muted-foreground mb-2">Common causes:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>
                                        <strong>API Key Issues:</strong> Invalid or expired key, insufficient credits
                                    </li>
                                    <li>
                                        <strong>Rate Limits:</strong> You may have hit provider rate limits - wait and
                                        try again
                                    </li>
                                    <li>
                                        <strong>Context Too Large:</strong> Too much lorebook context or chapter
                                        content. Try using "Use Custom Context" with fewer entries
                                    </li>
                                    <li>
                                        <strong>Local Server:</strong> Server crashed or model unloaded - restart LM
                                        Studio
                                    </li>
                                    <li>
                                        <strong>Network Issues:</strong> Check internet connection for cloud providers
                                    </li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Generation is Slow</h4>
                                <p className="text-sm text-muted-foreground mb-2">Speed factors:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>
                                        <strong>Local Models:</strong> Speed depends on your hardware (CPU/GPU)
                                    </li>
                                    <li>
                                        <strong>Cloud Models:</strong> Network speed and provider server load affect
                                        generation
                                    </li>
                                    <li>
                                        <strong>Context Size:</strong> More lorebook entries = slower generation. Use
                                        selective context
                                    </li>
                                    <li>
                                        <strong>Max Tokens:</strong> Higher max tokens = longer generation time
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-destructive pl-4 py-2">
                        <h3 className="text-lg font-medium">Lorebook Issues</h3>

                        <div className="space-y-3">
                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Entries Not Matching in Text</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>Check that entry is not disabled (eye icon should show enabled)</li>
                                    <li>Ensure tags include the exact text you're typing (case-insensitive match)</li>
                                    <li>Remember the entry name is automatically a tag</li>
                                    <li>Tags with special characters or spaces should still match</li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Can't See Series Lorebook Entries in Story</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>Verify your story is assigned to a series (edit story details to check)</li>
                                    <li>
                                        Series entries show with "Series" badge - look for the level badge on each entry
                                    </li>
                                    <li>If you just assigned the story to a series, try refreshing the page</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-l-4 border-destructive pl-4 py-2">
                        <h3 className="text-lg font-medium">Data & Storage Issues</h3>

                        <div className="space-y-3">
                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Changes Not Saving</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>
                                        <strong>Chapter Content:</strong> Auto-saves as you type with debounce - wait a
                                        moment after stopping typing
                                    </li>
                                    <li>
                                        <strong>Other Fields:</strong> Most save when you click Save/Update buttons or
                                        close dialogs
                                    </li>
                                    <li>Check browser console for errors (F12 → Console tab)</li>
                                    <li>Ensure you're not running out of disk space (SQLite database)</li>
                                </ul>
                            </div>

                            <div className="border rounded-lg p-4 bg-card">
                                <h4 className="font-medium text-sm mb-2">Where is My Data Stored?</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    All data is stored locally in an SQLite database on your machine:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                    <li>Database location depends on your installation method</li>
                                    <li>Nothing is sent to cloud (except AI API calls for generation)</li>
                                    <li>Back up the database file regularly if you want to preserve your work</li>
                                    <li>Consider using export features for additional backups</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <Alert className="mt-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Still Having Issues?</AlertTitle>
                        <AlertDescription>
                            <p className="mb-2">If you encounter persistent problems:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>Check the browser console (F12) for error messages</li>
                                <li>Try refreshing the page or restarting the application</li>
                                <li>
                                    Report issues at:{" "}
                                    <a
                                        href="https://github.com/JonSilver/TheStoryNexus/issues"
                                        className="text-primary underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        GitHub Issues
                                    </a>
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                </TabsContent>

                <TabsContent value="future" className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Future Guide Topics</h3>
                        <p>The following topics are planned for future guide updates:</p>
                    </div>

                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Coming Soon</AlertTitle>
                        <AlertDescription>
                            These topics are under development. Check back for updates as new features are documented.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Export & Archiving</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                        <li>Exporting stories in multiple formats</li>
                                        <li>Backing up your work</li>
                                        <li>Archiving completed projects</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Advanced Editor Features</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                        <li>Custom keyboard shortcuts</li>
                                        <li>Editor customisation options</li>
                                        <li>Advanced formatting techniques</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">AI Model Optimisation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                        <li>Choosing the right model for different tasks</li>
                                        <li>Understanding temperature and token settings</li>
                                        <li>Prompt engineering best practices</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Collaboration & Sharing</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                        <li>Sharing prompts and lorebooks</li>
                                        <li>Collaborative workflows (future feature)</li>
                                        <li>Community prompt libraries</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
