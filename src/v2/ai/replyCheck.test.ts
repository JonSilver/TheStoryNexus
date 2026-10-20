import { describe, expect, it } from "vitest";
import { checkReply, firstParagraphs } from "./replyCheck";

const passage =
    '"My own loss is great," said he, "in being obliged to leave so agreeable a party; but I am the more concerned, as I fear my presence is necessary to gain your admittance at Whitwell."';
const rework =
    '"My own loss is great," Colonel Brandon continued, "in being obliged to leave such a delightful gathering. However, I am even more troubled, as I fear my presence may be essential to secure your entry at Whitwell."';

describe("checkReply", () => {
    it("passes a clean rework, even a little longer than the passage", () => {
        expect(checkReply("rework", passage, rework).concerns).toEqual([]);
    });

    it("flags a rework with a list of revisions after it", () => {
        const reply = `${rework}\n\nRevisions made:\n\n1. Changed "so agreeable a party".\n2. Replaced "the more concerned".`;
        const check = checkReply("rework", passage, reply);
        expect(check.concerns.length).toBeGreaterThan(0);
        expect(check.hasExtraParagraphs).toBe(true);
        expect(firstParagraphs(reply, check.passageParagraphs)).toBe(rework);
    });

    it("flags a rework followed by an apology and a lecture", () => {
        const reply = `${rework}\n\nI apologize, but I'm unable to proceed with that as I am an English writing assistant.\n\nThank you again for your comprehension.`;
        const check = checkReply("rework", passage, reply);
        expect(check.concerns).toContain("it reads like the model talking about its work");
        expect(firstParagraphs(reply, check.passageParagraphs)).toBe(rework);
    });

    it("flags a shortening that came back longer", () => {
        expect(checkReply("shorten", passage, `${passage} And more besides.`).concerns).toContain(
            "it's much longer than your passage"
        );
    });

    it("lets an expansion grow, but not without bound", () => {
        expect(checkReply("expand", passage, `${rework} ${rework} ${rework}`).concerns).toEqual([]);
        expect(checkReply("expand", "Short.", "word ".repeat(400)).concerns).toContain(
            "it's much longer than your passage"
        );
    });

    it("keeps dialogue and the passage's own lists unflagged", () => {
        const list = "1. Flour\n2. Eggs";
        expect(checkReply("rework", list, "1. Plain flour\n2. Two eggs").concerns).toEqual([]);
    });

    it("judges Ask only by assistant-speak, not length", () => {
        expect(checkReply("ask", "Short.", "A much longer passage. ".repeat(50)).concerns).toEqual([]);
        expect(checkReply("ask", "Short.", "Here is the revised passage:\nShort indeed.").concerns.length).toBe(1);
    });
});
