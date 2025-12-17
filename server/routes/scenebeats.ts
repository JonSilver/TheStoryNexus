import type { InferSelectModel } from "drizzle-orm";
import { schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

type SceneBeat = InferSelectModel<typeof schema.sceneBeats>;

export default createCrudRouter({
    table: schema.sceneBeats,
    name: "Scene beat",
    parentKey: "chapterId",
    transforms: {
        afterRead: (sb: SceneBeat) => ({
            ...sb,
            metadata: parseJson(sb.metadata)
        })
    }
});
