import type { Story } from "@/types/story";
import { downloadAsFile } from "./downloadAsFile";

/**
 * Exports story to EPUB format (server-generated)
 */
export async function exportStoryAsEpub(story: Story): Promise<void> {
    const response = await fetch(`/api/stories/${story.id}/epub`);
    if (!response.ok) throw new Error("Failed to generate EPUB");

    const blob = await response.blob();
    downloadAsFile(blob, `${story.title}.epub`, "application/epub+zip");
}
