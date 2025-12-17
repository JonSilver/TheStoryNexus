import type { InferSelectModel } from "drizzle-orm";
import { schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

type AIChat = InferSelectModel<typeof schema.aiChats>;

export default createCrudRouter({
    table: schema.aiChats,
    name: "AI chat",
    parentKey: "storyId",
    transforms: {
        afterRead: (chat: AIChat) => ({
            ...chat,
            messages: parseJson(chat.messages)
        })
    }
});
