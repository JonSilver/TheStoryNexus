import { attemptPromise } from "@jfdi/attempt";
import type { Table } from "drizzle-orm";
import { eq, type InferSelectModel } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { type Request, type Response, Router } from "express";
import { db } from "../db/client.js";

type TableWithId = Table & { id: SQLiteColumn };

type CrudConfig<
    TTable extends TableWithId,
    TRow extends InferSelectModel<TTable> = InferSelectModel<TTable>,
    TTransformed = TRow
> = {
    table: TTable;
    name: string;
    parentKey?: keyof TRow & string;
    parentRoute?: string;
    transforms?: {
        afterRead?: (row: TRow) => TTransformed;
    };
    customRoutes?: (router: Router, helpers: RouteHelpers<TTable, TRow, TTransformed>) => void;
};

type RouteHelpers<TTable extends TableWithId, TRow, TTransformed = TRow> = {
    asyncHandler: (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => void;
    applyTransform: (data: TRow) => TTransformed;
    table: TTable;
};

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    const [error] = await attemptPromise(() => fn(req, res));
    if (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

export const createCrudRouter = <
    TTable extends TableWithId,
    TRow extends InferSelectModel<TTable> = InferSelectModel<TTable>,
    TTransformed = TRow
>(
    config: CrudConfig<TTable, TRow, TTransformed>
): Router => {
    const router = Router();
    const { table, name, parentKey, parentRoute, transforms, customRoutes } = config;

    const applyTransform = (data: TRow): TTransformed =>
        transforms?.afterRead ? transforms.afterRead(data) : (data as unknown as TTransformed);

    const helpers: RouteHelpers<TTable, TRow, TTransformed> = { asyncHandler, applyTransform, table };

    // Custom routes first (so they match before generic patterns)
    if (customRoutes) customRoutes(router, helpers);

    // GET all (optionally filtered by parent)
    if (parentKey) {
        const routePath = parentRoute || parentKey.replace(/Id$/, "");
        const paramName = parentRoute ? `${routePath}Id` : parentKey;
        router.get(
            `/${routePath}/:${paramName}`,
            asyncHandler(async (req, res) => {
                // TypeScript limitation: can't express that parentKey (keyof TRow) maps to table columns
                // At runtime, parentKey is constrained to valid column names via the type system
                const column = (table as unknown as Record<string, SQLiteColumn>)[parentKey];
                const rows = await db.select().from(table).where(eq(column, req.params[paramName]));
                res.json(rows.map(r => applyTransform(r as TRow)));
            })
        );
    } else {
        router.get(
            "/",
            asyncHandler(async (_, res) => {
                const rows = await db.select().from(table);
                res.json(rows.map(r => applyTransform(r as TRow)));
            })
        );
    }

    // GET by id
    router.get(
        "/:id",
        asyncHandler(async (req, res) => {
            const column = table.id;
            const [row] = await db.select().from(table).where(eq(column, req.params.id));
            if (!row) {
                res.status(404).json({ error: `${name} not found` });
                return;
            }
            res.json(applyTransform(row as TRow));
        })
    );

    // POST create
    router.post(
        "/",
        asyncHandler(async (req, res) => {
            const { id: _id, createdAt: _createdAt, ...bodyWithoutReserved } = req.body;
            const data = {
                id: req.body.id || crypto.randomUUID(),
                ...bodyWithoutReserved,
                createdAt: new Date()
            };
            const result = await db.insert(table).values(data).returning();
            const created = Array.isArray(result) ? result[0] : result;
            res.status(201).json(applyTransform(created as TRow));
        })
    );

    // PUT update
    router.put(
        "/:id",
        asyncHandler(async (req, res) => {
            const { id: _id, createdAt: _createdAt, ...updates } = req.body;
            const column = table.id;
            const result = await db.update(table).set(updates).where(eq(column, req.params.id)).returning();
            const updated = Array.isArray(result) ? result[0] : result;
            if (!updated) {
                res.status(404).json({ error: `${name} not found` });
                return;
            }
            res.json(applyTransform(updated as TRow));
        })
    );

    // DELETE
    router.delete(
        "/:id",
        asyncHandler(async (req, res) => {
            const column = table.id;
            await db.delete(table).where(eq(column, req.params.id));
            res.json({ success: true });
        })
    );

    return router;
};
