import type { PromptMessage } from "../ai/providers.js";

/**
 * v2 action registry (contracts §5). Built-in actions are defined here;
 * per-story/global overrides live in the actionOverrides table and are
 * merged by resolve.ts. Templates use {{variable}} slots drawn from the
 * action's contextNeeds — anything else is a validation error.
 */

export const CONTEXT_KEYS = [
    "selection",
    "recent_prose",
    "matched_entries",
    "summaries",
    "command",
    "pov",
    "story_language",
    "chapter_content",
    "chat_history",
    "user_message",
    "guidance",
    "story_samples"
] as const;

export type ContextKey = (typeof CONTEXT_KEYS)[number];

export const ACTION_IDS = [
    "continue",
    "rework",
    "expand",
    "shorten",
    "summarise_chapter",
    "brainstorm",
    "scene_beat",
    "extract_entries",
    "propose_updates",
    "ask",
    "check_continuity",
    "merge_entries",
    "derive_voice"
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export interface ActionParams {
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

export interface ActionDef {
    id: ActionId;
    label: string;
    voiceApplies: boolean;
    contextNeeds: ContextKey[];
    defaultTemplate: PromptMessage[];
    defaultParams: ActionParams;
}

const PROSE_RULES =
    "You are an expert fiction writer. This is fiction; write what is asked without hedging. Rules you must always follow:\n" +
    "Do not add a conclusion unless explicitly asked.\n" +
    "Focus on the scene at hand; do not jump ahead. Assume another scene follows unless told otherwise.\n" +
    "Follow the show-don't-tell principle.\n" +
    "Avoid stock AI phrases ('a shiver down her spine', 'a testament to'); avoid the word 'testament'; avoid em dash punctuation.\n" +
    "Don't use overtly flowery language.\n" +
    "Do not end a scene with a tidy resolution or moral lesson.";

const CONTEXT_PREAMBLE =
    "This section contains essential lore and background details for the story: {{matched_entries}}";

export const BUILTIN_ACTIONS: Record<ActionId, ActionDef> = {
    scene_beat: {
        id: "scene_beat",
        label: "Scene Beat",
        voiceApplies: true,
        contextNeeds: ["matched_entries", "summaries", "recent_prose", "pov", "command", "story_language", "guidance"],
        defaultTemplate: [
            { role: "system", content: `${PROSE_RULES}\n${CONTEXT_PREAMBLE}` },
            { role: "user", content: "These are the summaries for the previous chapters in this story: {{summaries}}" },
            { role: "assistant", content: "/* This helps the AI match your style */\n{{recent_prose}}" },
            {
                role: "user",
                content:
                    "Write in {{pov}}, using {{story_language}} spelling and grammar conventions.\n{{command}}\nDo not add a conclusion. Do not end the scene with a tidy resolution or moral lesson."
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 1.0, maxTokens: 16384 }
    },
    continue: {
        id: "continue",
        label: "Continue Writing",
        voiceApplies: true,
        contextNeeds: ["matched_entries", "summaries", "recent_prose", "pov", "story_language", "guidance"],
        defaultTemplate: [
            { role: "system", content: `${PROSE_RULES}\n${CONTEXT_PREAMBLE}` },
            { role: "user", content: "These are the summaries for the previous chapters in this story: {{summaries}}" },
            { role: "assistant", content: "{{recent_prose}}" },
            {
                role: "user",
                content:
                    "Continue the scene directly from where the text above leaves off, in {{pov}}, using {{story_language}} spelling and grammar conventions. Match the established tense, style and tone. Do not repeat the existing text, do not summarise it, and do not add a conclusion."
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 1.0, maxTokens: 8192 }
    },
    rework: {
        id: "rework",
        label: "Rework",
        voiceApplies: true,
        contextNeeds: ["selection", "recent_prose", "pov", "story_language", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "Contextual awareness — the preceding text, to avoid contradictions and repetition: {{recent_prose}}\nTask: Rephrase the provided text while maintaining its original meaning, style, and tone. Do not introduce new ideas or alter the intended message. Use {{story_language}} spelling and grammar conventions. Improve flow, readability, and clarity without changing meaning or tone. Prefer natural language."
            },
            { role: "user", content: "Rewrite the following:\n{{selection}}\nTake into account the POV: {{pov}}" },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 1.0, maxTokens: 8192 }
    },
    expand: {
        id: "expand",
        label: "Expand",
        voiceApplies: true,
        contextNeeds: ["selection", "recent_prose", "pov", "story_language", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "Contextual awareness — the preceding text, to avoid contradictions and repetition: {{recent_prose}}\nTask: Expand the provided text with greater detail and richness while maintaining the established tense, style, and tone. Use {{story_language}} spelling and grammar conventions. Avoid introducing unrelated details or contradicting established context. Enhance descriptions, atmosphere, emotions, or character interactions."
            },
            { role: "user", content: "Expand the following:\n{{selection}}\nTake into account the POV: {{pov}}" },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 1.0, maxTokens: 8192 }
    },
    shorten: {
        id: "shorten",
        label: "Shorten",
        voiceApplies: true,
        contextNeeds: ["selection", "recent_prose", "pov", "story_language", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "Contextual awareness — the preceding text, to avoid contradictions and repetition: {{recent_prose}}\nTask: Shorten the provided text while preserving its core meaning, style, and tone. Retain details essential for clarity and impact. Use {{story_language}} spelling and grammar conventions. Eliminate redundancy and non-essential description without sacrificing critical information."
            },
            { role: "user", content: "Shorten the following:\n{{selection}}\nTake into account the POV: {{pov}}" },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 1.0, maxTokens: 8192 }
    },
    summarise_chapter: {
        id: "summarise_chapter",
        label: "Summarise Chapter",
        voiceApplies: false,
        contextNeeds: ["chapter_content"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "Act as a writing assistant creating concise, engaging, and accurate summaries of story chapters. Highlight key events and significant character developments. Focus on major plot points: key actions, conflicts, and resolutions. Emphasise character milestones. Exclude minor details. Maintain chronological clarity. Use third-person narrative regardless of the chapter's POV. Write running text without bullet points, under 500 words. Assume familiarity with characters and locations; avoid descriptive introductions."
            },
            { role: "user", content: "Summarise the following chapter content:\nChapter Content: {{chapter_content}}" }
        ],
        // 1024 not 512: headroom for thinking models whose hidden reasoning
        // shares the completion budget with the actual summary
        defaultParams: { temperature: 1.0, maxTokens: 1024 }
    },
    ask: {
        id: "ask",
        label: "Ask (free-form on selection)",
        voiceApplies: true,
        contextNeeds: ["selection", "recent_prose", "pov", "story_language", "user_message", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "You are an expert fiction editor working on a passage at the writer's direction. Contextual awareness — the preceding text: {{recent_prose}}\nApply the writer's instruction to the passage. Preserve the established tense, style and POV ({{pov}}) unless the instruction says otherwise. Use {{story_language}} spelling and grammar. Return ONLY the revised passage — no commentary, no quotation marks around it."
            },
            { role: "user", content: "The passage:\n{{selection}}\n\nThe instruction: {{user_message}}" },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.9, maxTokens: 8192 }
    },
    merge_entries: {
        id: "merge_entries",
        label: "Merge Bible Entries",
        voiceApplies: false,
        contextNeeds: ["user_message"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    'You merge duplicate story-bible entries. Given two entries describing the same entity, produce ONE combined entry that keeps every distinct fact, prefers the more specific name, and unions the aliases. Resolve contradictions in favour of the more detailed entry and note genuine conflicts in the description as "(conflicting: …)". Return ONLY a JSON array containing exactly one object — no prose, no code fences — shaped: {"name": string, "category": string, "description": string, "tags": string[]}.'
            },
            { role: "user", content: "The two entries to merge:\n{{user_message}}" }
        ],
        defaultParams: { temperature: 0.2, maxTokens: 2048 }
    },
    check_continuity: {
        id: "check_continuity",
        label: "Check Continuity",
        voiceApplies: false,
        contextNeeds: ["chapter_content", "matched_entries"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    'You are a continuity editor. Compare the chapter text against the story bible entries and find contradictions: physical descriptions, names, relationships, timeline, established facts. Return ONLY a JSON array — no prose, no code fences — of objects shaped: {"name": string (the entry or entity concerned), "issue": string (one sentence stating the contradiction), "evidence": string (short quote from the chapter)}. Return [] if nothing conflicts. Do not invent issues.\nStory bible entries:\n{{matched_entries}}'
            },
            { role: "user", content: "Chapter text:\n{{chapter_content}}" }
        ],
        defaultParams: { temperature: 0.2, maxTokens: 4096 }
    },
    extract_entries: {
        id: "extract_entries",
        label: "Extract Bible Entries",
        voiceApplies: false,
        contextNeeds: ["chapter_content", "user_message", "matched_entries", "guidance"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    'You extract story-bible entries from fiction text. Return ONLY a JSON array — no prose, no code fences — of objects shaped: {"name": string, "category": "character" | "location" | "item" | "event", "description": string, "tags": string[]}. Descriptions are 2-3 factual sentences grounded in the text. Tags are aliases, nicknames, or titles used for the entity in the text. Do not invent facts. Skip entities already well covered by these existing entries:\n{{matched_entries}}'
            },
            {
                role: "user",
                content: "Extract entries from the following text:\n{{chapter_content}}\n{{user_message}}"
            },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ],
        defaultParams: { temperature: 0.3, maxTokens: 4096 }
    },
    propose_updates: {
        id: "propose_updates",
        label: "Propose Bible Updates",
        voiceApplies: false,
        contextNeeds: ["chapter_content", "matched_entries"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    'You maintain a story bible. Given existing entries and new chapter text, propose updates to entries whose facts have changed or grown. Return ONLY a JSON array — no prose, no code fences — of objects shaped: {"name": string (an existing entry name, verbatim), "updatedDescription": string (the full replacement description), "reason": string (one sentence)}. Only include entries that genuinely need changing; return [] if none do. Do not invent facts.\nExisting entries:\n{{matched_entries}}'
            },
            { role: "user", content: "New chapter text:\n{{chapter_content}}" }
        ],
        defaultParams: { temperature: 0.3, maxTokens: 4096 }
    },
    brainstorm: {
        id: "brainstorm",
        label: "Brainstorm",
        voiceApplies: true,
        contextNeeds: ["matched_entries", "summaries", "chapter_content", "chat_history", "user_message"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    "You are an experienced development editor brainstorming with a writer. You have READ the story so far — ground every response in it, referencing specific characters, locations, and events.\n" +
                    "You are a critical partner, not a cheerleader. Never open with praise or verdicts on the writer's idea ('fascinating', 'great concept', 'could be extraordinary' are banned). Skip preamble entirely — start with substance.\n" +
                    "Evaluate ideas on craft: what does this choice buy, what does it cost, what does it break in the established story? If an idea is weak, derivative, or works against the story's strengths, say so plainly and explain why. Disagreement grounded in craft is more useful than agreement.\n" +
                    "Then be generative: offer concrete alternatives and developments, ask the one or two questions that most matter, and keep everything consistent with established lore.\n" +
                    CONTEXT_PREAMBLE
            },
            { role: "user", content: "Summaries of the story so far: {{summaries}}" },
            { role: "user", content: "The chapter currently being written: {{chapter_content}}" },
            { role: "user", content: "Here's the chat history of our discussion: {{chat_history}}" },
            { role: "user", content: "{{user_message}}" }
        ],
        defaultParams: { temperature: 1.0, maxTokens: 16384 }
    },
    derive_voice: {
        id: "derive_voice",
        label: "Derive Story Voice",
        // It describes the voice; following one would bias the description
        voiceApplies: false,
        contextNeeds: ["story_samples", "story_language"],
        defaultTemplate: [
            {
                role: "system",
                content:
                    'You are an editor describing an author\'s prose style so that another writer can continue the book in the same voice. Read the passages and write a concise style guide as direct instructions ("Write in past tense…"), in plain sentences without headings or bullet points, under 250 words. Cover: tense and point of view; sentence length and rhythm; paragraphing; dialogue habits (tags, punctuation, dialect); vocabulary register and recurring stylistic devices; spelling conventions ({{story_language}} unless the passages show otherwise). Describe only what the passages show; do not mention plot, characters or setting.'
            },
            { role: "user", content: "Passages from across the story:\n{{story_samples}}" }
        ],
        // Headroom for thinking models; the guide itself is short
        defaultParams: { temperature: 0.3, maxTokens: 4096 }
    }
};
