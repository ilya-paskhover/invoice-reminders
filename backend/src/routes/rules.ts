import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "../config";
import { ALLOWED_PLACEHOLDERS, findUnknownPlaceholders } from "../reminders/templates";

const fields = {
  name: z.string().min(1).max(200),
  offset_days: z.number().int().min(1).max(365),
  subject_template: z.string().min(1).max(500),
  body_template: z.string().min(1).max(10000),
  active: z.boolean(),
};
const createSchema = z.object({ ...fields, active: fields.active.optional() });
const updateSchema = z.object(fields).partial();

const COLS = "id, name, offset_days, subject_template, body_template, active, created_at";

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: "Validation failed",
    details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

function placeholderError(reply: FastifyReply, data: Record<string, unknown>) {
  const details: { path: string; message: string }[] = [];
  for (const key of ["subject_template", "body_template"] as const) {
    const v = data[key];
    if (typeof v !== "string") continue;
    const unknown = findUnknownPlaceholders(v);
    if (unknown.length > 0) {
      details.push({
        path: key,
        message: `Unknown placeholder ${unknown.map((u) => `{{${u}}}`).join(", ")}. Allowed: ${ALLOWED_PLACEHOLDERS.join(", ")}`,
      });
    }
  }
  if (details.length === 0) return null;
  return reply.code(400).send({
    error: `Unknown placeholder. ${details.map((d) => d.message).join(" ")}`,
    details,
  });
}

export function registerRuleRoutes(app: FastifyInstance, pool: pg.Pool, config?: Config): void {
  app.get("/api/rules", async () => {
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM reminder_rules ORDER BY offset_days ASC, id ASC`,
    );
    return rows;
  });

  app.post("/api/rules", async (req, reply) => {
    const p = createSchema.safeParse(req.body ?? {});
    if (!p.success) return validationError(reply, p.error);
    const bad = placeholderError(reply, p.data);
    if (bad) return bad;
    const d = p.data;
    if (config?.demoMode) {
      const c = await pool.query("SELECT count(*)::int AS n FROM reminder_rules");
      if (c.rows[0].n >= config.demoMaxRules) {
        return reply.code(409).send({
          error: `Demo limit reached: at most ${config.demoMaxRules} rules. Use Reset demo data.`,
        });
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO reminder_rules (name, offset_days, subject_template, body_template, active)
       VALUES ($1,$2,$3,$4,$5) RETURNING ${COLS}`,
      [d.name, d.offset_days, d.subject_template, d.body_template, d.active ?? true],
    );
    return reply.code(201).send(rows[0]);
  });

  app.put<{ Params: { id: string } }>("/api/rules/:id", async (req, reply) => {
    const id = /^\d{1,9}$/.test(req.params.id) ? Number(req.params.id) : null;
    const p = updateSchema.safeParse(req.body ?? {});
    if (!p.success) return validationError(reply, p.error);
    const bad = placeholderError(reply, p.data);
    if (bad) return bad;
    if (id === null) return reply.code(404).send({ error: "Rule not found" });
    const entries = Object.entries(p.data).filter(([, v]) => v !== undefined);
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`);
    const sql =
      sets.length > 0
        ? `UPDATE reminder_rules SET ${sets.join(", ")} WHERE id = $1 RETURNING ${COLS}`
        : `SELECT ${COLS} FROM reminder_rules WHERE id = $1`;
    const { rows } = await pool.query(sql, [id, ...entries.map(([, v]) => v)]);
    if (!rows[0]) return reply.code(404).send({ error: "Rule not found" });
    return rows[0];
  });
}
