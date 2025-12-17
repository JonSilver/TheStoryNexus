import { schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";

export default createCrudRouter({
    table: schema.notes,
    name: "Note",
    parentKey: "storyId"
});
