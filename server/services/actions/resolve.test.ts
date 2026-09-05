import { describe, expect, it } from "vitest";
import type { PromptMessage } from "../ai/providers.js";
import { ACTION_IDS, BUILTIN_ACTIONS } from "./registry.js";
import { type ActionOverrideRow, renderTemplate, resolveAction, templateVariables, validateTemplate } from "./resolve.js";

const override = (partial: Partial<ActionOverrideRow>): ActionOverrideRow => ({
    actionId: "rework",
    storyId: null,
    template: null,
    temperature: null,
    maxTokens: null,
    topP: null,
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
        expect(resolved.params.temperature).toBe(1.0);
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

    it("ignores other stories' overrides", () => {
        const resolved = resolveAction("rework", "story-1", [override({ storyId: "story-2", temperature: 0.1 })]);
        expect(resolved.params.temperature).toBe(1.0);
    });
});

describe("renderTemplate", () => {
    const template: PromptMessage[] = [
        { role: "system", content: "Rules here. /* comment {{bogus}} */ Context: {{matched_entries}}" },
        { role: "user", content: "POV: {{pov}}\n{{command}}" },
        { role: "user", content: "{{summaries}}" }
    ];

    it("substitutes context, strips comments, drops empty messages", () => {
        const rendered = renderTemplate(template, { matched_entries: "Mara: captain", pov: "First Person", command: "Fight!" });
        expect(rendered).toHaveLength(2); // summaries message rendered empty and dropped
        expect(rendered[0].content).toBe("Rules here.  Context: Mara: captain");
        expect(rendered[1].content).toBe("POV: First Person\nFight!");
    });

    it("appends voice to the system message only when provided", () => {
        const rendered = renderTemplate(template, { matched_entries: "x", pov: "y", command: "z" }, "Past tense, dry wit.");
        expect(rendered[0].content).toContain("Story voice and framing (follow strictly): Past tense, dry wit.");
        expect(rendered[1].content).not.toContain("Story voice");
    });
});
