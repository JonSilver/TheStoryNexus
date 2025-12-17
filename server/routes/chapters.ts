import type { InferSelectModel } from "drizzle-orm";
import { schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

type Chapter = InferSelectModel<typeof schema.chapters>;

export default createCrudRouter({
    table: schema.chapters,
    name: "Chapter",
    parentKey: "storyId",
    transforms: {
        afterRead: (ch: Chapter) => ({
            ...ch,
            outline: parseJson(ch.outline),
            notes: parseJson(ch.notes)
        })
    }
});
