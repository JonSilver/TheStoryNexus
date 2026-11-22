import type { ActionDef, ActionId } from "./registry.js";

/** The built-in actions of transposition (contracts §11a), one per layer. */
export const TRANSPOSE_ACTIONS: Record<Extract<ActionId, `transpose_${string}`>, ActionDef> = {
    transpose_brief: {
        id: "transpose_brief",
        label: "Transpose: Brief",
        voiceApplies: false,
        contextNeeds: ["transposition_target", "story_synopsis", "story_bible", "story_summaries", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "You are a story editor planning how to transpose a novel to a different time, place or background. From the story's synopsis, bible and chapter summaries, write the transposition brief that every later rewrite will follow. Use these plain headings:\n" +
                    "Setting: where and when, in concrete terms.\n" +
                    "Equivalents: each important place, institution, technology, custom, form of address and idiom in the story, and its counterpart in the new setting, as 'Original → New: why'.\n" +
                    "Social pressures: what in the new setting creates the constraints and stakes that drive the plot, as the original world's did, so the story's tensions survive rather than becoming a costume change.\n" +
                    "Names: how character and place names are adapted.\n" +
                    "Language: register, dialect and period idiom for narration and dialogue.\n" +
                    "What must not change: the plot's events, the relationships and the emotional beats.\n" +
                    "Be specific and decisive: choose, don't list options. Under 900 words."
            },
            {
                role: "user",
                content:
                    "The new setting: {{transposition_target}}\n\nSynopsis:\n{{story_synopsis}}\n\nStory bible:\n{{story_bible}}\n\nChapter summaries:\n{{story_summaries}}"
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.7, maxTokens: 4096 }
    },
    transpose_synopsis: {
        id: "transpose_synopsis",
        label: "Transpose: Synopsis",
        voiceApplies: false,
        contextNeeds: ["transposition_brief", "story_bible", "story_synopsis", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "You rewrite a story's synopsis for its transposed version, following the transposition brief exactly: the same plot, roles and arcs, in the new setting and with the new names. Reply with the synopsis alone, about as long as the original.\nTransposition brief:\n{{transposition_brief}}"
            },
            {
                role: "user",
                content: "The story bible:\n{{story_bible}}\n\nThe original synopsis:\n{{story_synopsis}}"
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.7, maxTokens: 2048 }
    },
    transpose_entry: {
        id: "transpose_entry",
        label: "Transpose: Bible Entry",
        voiceApplies: false,
        contextNeeds: ["transposition_brief", "story_bible", "user_message", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    'You transpose one story-bible entry to the story\'s new setting, following the transposition brief. Keep what the entry does in the story (its role, relationships and significance); change names, places, period details and idiom to suit the new setting, consistently with the entries already transposed. Return ONLY a JSON array containing exactly one object — no prose, no code fences — shaped: {"name": string, "description": string, "tags": string[]}. Tags are the aliases, nicknames or titles used for it in the new setting.\nTransposition brief:\n{{transposition_brief}}'
            },
            {
                role: "user",
                content: "The story bible so far:\n{{story_bible}}\n\nThe entry to transpose:\n{{user_message}}"
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.5, maxTokens: 2048 }
    },
    transpose_outline: {
        id: "transpose_outline",
        label: "Transpose: Chapter Outline",
        voiceApplies: false,
        contextNeeds: ["transposition_brief", "story_bible", "transposed_summaries", "chapter_summary", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "You transpose one chapter of a novel to its new setting, as an outline: what happens in it, in order, with the new names, places and period, following the transposition brief and the bible. Keep every event, its cause and its emotional beat; change only what the setting changes. Stay continuous with the chapters already transposed. Write running text without bullet points, under 400 words.\nTransposition brief:\n{{transposition_brief}}"
            },
            {
                role: "user",
                content:
                    "The story bible, original → transposed:\n{{story_bible}}\n\nThe chapters before this one, transposed:\n{{transposed_summaries}}\n\nThis chapter as it was:\n{{chapter_summary}}"
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.6, maxTokens: 2048 }
    },
    transpose_prose: {
        id: "transpose_prose",
        label: "Transpose: Chapter Prose",
        voiceApplies: true,
        insertsProse: true,
        contextNeeds: [
            "transposition_brief",
            "story_bible",
            "user_message",
            "recent_prose",
            "selection",
            "pov",
            "story_language",
            "guidance"
        ],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "You rewrite a passage of a novel into the story's new setting, following the transposition brief and the bible. Keep every event, beat and exchange, the point of view, the tense, the paragraphing and the length (within a tenth); change names, places, period detail, idiom and the register of dialogue as the brief says. Add nothing that isn't there and drop nothing that is. Use {{story_language}} spelling and grammar. Where the story voice and the brief disagree about setting, period or dialect, the brief wins.\nTransposition brief:\n{{transposition_brief}}\nThe bible, original → transposed:\n{{story_bible}}"
            },
            { role: "user", content: "This chapter, transposed, in outline:\n{{user_message}}" },
            {
                role: "assistant",
                content: "/* Continuity: the end of the passage before, already rewritten */\n{{recent_prose}}"
            },
            {
                role: "user",
                content: "Rewrite this passage of the original, in {{pov}}:\n{{selection}}"
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.8, maxTokens: 8192 }
    }
};
