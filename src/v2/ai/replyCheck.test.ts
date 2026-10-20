import { describe, expect, it } from "vitest";
import { checkReply } from "./replyCheck";

const passage =
    '"My own loss is great," said he, "in being obliged to leave so agreeable a party; but I am the more concerned, as I fear my presence is necessary to gain your admittance at Whitwell."';
const rework =
    '"My own loss is great," Colonel Brandon continued, "in being obliged to leave such a delightful gathering. However, I am even more troubled, as I fear my presence may be essential to secure your entry at Whitwell."';

describe("checkReply", () => {
    it("passes a clean rework, even a little longer than the passage", () => {
        expect(checkReply("rework", passage, rework)).toEqual({ concerns: [], proseOnly: null });
    });

    it("finds a list of revisions after the rewrite, and offers the rewrite alone", () => {
        const reply = `${rework}\n\nRevisions made:\n\n1. Changed "so agreeable a party" to "such a delightful gathering".\n2. Replaced "the more concerned" with "even more troubled".\n\nThe rewritten sentence maintains the formal style of the original.`;
        const check = checkReply("rework", passage, reply);
        expect(check.concerns).toContain("part of it reads like the model's notes, not your story");
        expect(check.proseOnly).toBe(rework);
    });

    it("finds an apology and lecture after the rewrite, tail and all", () => {
        const reply = `${rework}\n\nI apologize, but I'm unable to proceed with that as I am an English writing assistant.\n\nThank you again for your comprehension.`;
        expect(checkReply("rework", passage, reply).proseOnly).toBe(rework);
    });

    it("finds a preamble before the rewrite", () => {
        const reply = `Here is the revised passage:\n\n${rework}`;
        expect(checkReply("rework", passage, reply).proseOnly).toBe(rework);
    });

    it("never takes dialogue for notes", () => {
        const dialogue = '"I\'m sorry," she said. "I cannot help you, and I hope this helps you understand why."';
        expect(
            checkReply("ask", dialogue, `${dialogue}\n\n"Let me know when you've decided," he replied.`).concerns
        ).toEqual([]);
    });

    it("lets a rework become two paragraphs, and a shortening stay as long", () => {
        const two = 'He said he must go.\n\n"Whitwell needs me," he added.';
        expect(checkReply("rework", "He said he must go, for Whitwell needed him.", two).concerns).toEqual([]);
        expect(checkReply("shorten", passage, passage).concerns).toEqual([]);
    });

    it("reports a shortening that grew, without offering to cut it", () => {
        const check = checkReply("shorten", passage, `${passage} And more besides.`);
        expect(check.concerns).toEqual(["it's longer than your passage"]);
        expect(check.proseOnly).toBeNull();
    });

    it("never limits an expansion or an Ask by length", () => {
        expect(checkReply("expand", "Short.", "A longer passage. ".repeat(200)).concerns).toEqual([]);
        expect(checkReply("ask", "Short.", "1. Flour\n2. Eggs").concerns).toEqual([]);
    });
});
