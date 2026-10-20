import { describe, expect, it } from "vitest";
import type { PromptMessage } from "../ai/providers.js";
import { ACTION_IDS, BUILTIN_ACTIONS, PROSE_ONLY } from "./registry.js";
import {
    type ActionOverrideRow,
    renderActionPrompt,
    renderTemplate,
    resolveAction,
    templateVariables,
    validateTemplate
} from "./resolve.js";

const override = (partial: Partial<ActionOverrideRow>): ActionOverrideRow => ({
    actionId: "rework",
    storyId: null,
    template: null,
    temperature: null,
    maxTokens: null,
    topP: null,
    frequencyPenalty: null,
    presencePenalty: null,
    modelRef: null,
    ...partial
});

describe("built-in templates", () => {
    it("every built-in template only uses variables from its own contextNeeds", () => {
        for (const id of ACTION_IDS) {
            const def = BUILTIN_ACTIONS[id];
            expect(validateTemplate(def.defaultTemplate, def.contextNeeds), id).toEqual({ valid: true });
        }
    });
});

describe("validateTemplate", () => {
    it("flags unknown variables", () => {
        const messages: PromptMessage[] = [{ role: "user", content: "Use {{caracters}} and {{selection}}" }];
        expect(validateTemplate(messages, ["selection"])).toEqual({
            valid: false,
            unknownVariables: ["caracters"]
        });
    });

    it("ignores variables inside comments", () => {
        const messages: PromptMessage[] = [{ role: "user", content: "/* {{bogus}} */ {{selection}}" }];
        expect(validateTemplate(messages, ["selection"])).toEqual({ valid: true });
        expect(templateVariables(messages)).toEqual(["selection"]);
    });
});

describe("resolveAction precedence", () => {
    it("returns built-in defaults with no overrides", () => {
        const resolved = resolveAction("rework", "story-1", []);
        expect(resolved.template).toBe(BUILTIN_ACTIONS.rework.defaultTemplate);
        expect(resolved.params.temperature).toBe(BUILTIN_ACTIONS.rework.defaultParams.temperature);
        expect(resolved.modelRef).toBeUndefined();
    });

    it("story override beats global override beats built-in", () => {
        const rows = [
            override({ storyId: null, temperature: 0.5, maxTokens: 100 }),
            override({ storyId: "story-1", temperature: 0.2 })
        ];
        const resolved = resolveAction("rework", "story-1", rows);
        expect(resolved.params.temperature).toBe(0.2); // story
        expect(resolved.params.maxTokens).toBe(100); // global fills the gap
    });

    it("invalid override template falls back to built-in", () => {
        const rows = [
            override({
                storyId: "story-1",
                template: [{ role: "user", content: "{{not_a_real_variable}}" }] as PromptMessage[]
            })
        ];
        const resolved = resolveAction("rework", "story-1", rows);
        expect(resolved.template).toBe(BUILTIN_ACTIONS.rework.defaultTemplate);
    });

    it("valid override template is used", () => {
        const template: PromptMessage[] = [{ role: "user", content: "Rework: {{selection}}" }];
        const resolved = resolveAction("rework", "story-1", [override({ storyId: "story-1", template })]);
        expect(resolved.template).toBe(template);
    });

    it("resolves penalty and topP overrides", () => {
        const rows = [override({ storyId: "story-1", topP: 0.9, frequencyPenalty: 0.4, presencePenalty: -0.2 })];
        const resolved = resolveAction("rework", "story-1", rows);
        expect(resolved.params.topP).toBe(0.9);
        expect(resolved.params.frequencyPenalty).toBe(0.4);
        expect(resolved.params.presencePenalty).toBe(-0.2);
    });

    it("invalid stored values fall through to the next scope, not clamped (§5)", () => {
        const rows = [
            override({ storyId: "story-1", temperature: 9, frequencyPenalty: 5 }),
            override({ storyId: null, temperature: 0.4, frequencyPenalty: 1.1 })
        ];
        const resolved = resolveAction("rework", "story-1", rows);
        expect(resolved.params.temperature).toBe(0.4);
        expect(resolved.params.frequencyPenalty).toBe(1.1);
    });

    it("malformed modelRef falls through to the next scope", () => {
        const rows = [
            override({ storyId: "story-1", modelRef: "not-a-ref" }),
            override({ storyId: null, modelRef: "local::local/qwen3:8b" })
        ];
        expect(resolveAction("rework", "story-1", rows).modelRef).toBe("local::local/qwen3:8b");
        expect(resolveAction("rework", "story-1", rows).modelScope).toBe("global");
    });

    it("says which scope chose the model", () => {
        const rows = [
            override({ storyId: "story-1", modelRef: "openrouter::a/story-model" }),
            override({ storyId: null, modelRef: "local::local/qwen3:8b" })
        ];
        expect(resolveAction("rework", "story-1", rows)).toMatchObject({
            modelRef: "openrouter::a/story-model",
            modelScope: "story"
        });
        expect(resolveAction("rework", "story-1", []).modelScope).toBeUndefined();
    });

    it("ignores other stories' overrides", () => {
        const resolved = resolveAction("rework", "story-1", [override({ storyId: "story-2", temperature: 0.1 })]);
        expect(resolved.params.temperature).toBe(BUILTIN_ACTIONS.rework.defaultParams.temperature);
    });
});

describe("renderTemplate", () => {
    const template: PromptMessage[] = [
        { role: "system", content: "Rules here. /* comment {{bogus}} */ Context: {{matched_entries}}" },
        { role: "user", content: "POV: {{pov}}\n{{command}}" },
        { role: "user", content: "{{summaries}}" }
    ];

    it("substitutes context, strips comments, drops empty messages", () => {
        const rendered = renderTemplate(template, {
            matched_entries: "Mara: captain",
            pov: "First Person",
            command: "Fight!"
        });
        expect(rendered).toHaveLength(2); // summaries message rendered empty and dropped
        expect(rendered[0].content).toBe("Rules here.  Context: Mara: captain");
        expect(rendered[1].content).toBe("POV: First Person\nFight!");
    });

    it("appends voice to the system message only when provided", () => {
        const rendered = renderTemplate(
            template,
            { matched_entries: "x", pov: "y", command: "z" },
            "Past tense, dry wit."
        );
        expect(rendered[0].content).toContain("Story voice and framing (follow strictly): Past tense, dry wit.");
        expect(rendered[1].content).not.toContain("Story voice");
    });

    it("drops label-only messages whose every variable resolved empty", () => {
        const labelled: PromptMessage[] = [
            { role: "system", content: "Rules. Context: {{matched_entries}}" },
            { role: "user", content: "The command: {{command}}" },
            { role: "user", content: "Additional instruction from the writer — follow it: {{guidance}}" }
        ];
        const rendered = renderTemplate(labelled, { command: "Fight!" });
        expect(rendered.map(m => m.content)).toEqual(["Rules. Context:", "The command: Fight!"]);
    });

    it("keeps a mixed message when at least one variable resolved", () => {
        const mixed: PromptMessage[] = [{ role: "user", content: "Passage: {{selection}}\nInstruction: {{guidance}}" }];
        expect(renderTemplate(mixed, { selection: "Some text" })[0].content).toBe("Passage: Some text\nInstruction:");
    });
});

describe("renderActionPrompt", () => {
    const context = { selection: "She left." };

    it("ends a prose action's system prompt with PROSE_ONLY, after the story voice", () => {
        const messages = renderActionPrompt(
            BUILTIN_ACTIONS.rework,
            BUILTIN_ACTIONS.rework.defaultTemplate,
            context,
            "Wry."
        );
        const system = messages[0].content;
        expect(system.endsWith(PROSE_ONLY)).toBe(true);
        expect(system.indexOf("Wry.")).toBeLessThan(system.indexOf(PROSE_ONLY));
    });

    it("holds for a customised template too, even one without a system message", () => {
        const custom: PromptMessage[] = [{ role: "user", content: "Make it sing: {{selection}}" }];
        const messages = renderActionPrompt(BUILTIN_ACTIONS.rework, custom, context);
        expect(messages[0]).toEqual({ role: "system", content: PROSE_ONLY });
        expect(messages[1].content).toBe("Make it sing: She left.");
    });

    it("goes on the last system message of a template with several", () => {
        const custom: PromptMessage[] = [
            { role: "system", content: "Be a fine editor." },
            { role: "user", content: "{{selection}}" },
            { role: "system", content: "Keep it British." }
        ];
        const messages = renderActionPrompt(BUILTIN_ACTIONS.rework, custom, context);
        expect(messages[2].content.endsWith(PROSE_ONLY)).toBe(true);
        expect(messages[0].content).toBe("Be a fine editor.");
    });

    it("leaves other actions alone", () => {
        const def = BUILTIN_ACTIONS.summarise_chapter;
        expect(renderActionPrompt(def, def.defaultTemplate, {}).some(m => m.content.includes(PROSE_ONLY))).toBe(false);
    });
});
