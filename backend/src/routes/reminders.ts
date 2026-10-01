import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { listReminders, runDueReminders, sendNextReminder, type EngineDeps } from "../reminders/engine";

const runBody = z
  .object({
    as_of: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
      .refine((s) => {
        const d = new Date(`${s}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
      }, "invalid date")
      .optional(),
  })
  .optional()
  .nullable();

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: "Validation failed",
    details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

export function registerReminderRoutes(app: FastifyInstance, deps: EngineDeps): void {
  app.post("/api/reminders/run", async (req, reply) => {
    const p = runBody.safeParse(req.body);
    if (!p.success) return validationError(reply, p.error);
    return runDueReminders(deps, p.data?.as_of);
  });

  app.get("/api/reminders", async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return validationError(reply, q.error);
    return listReminders(deps.pool, q.data.limit);
  });

  app.post<{ Params: { id: string } }>("/api/invoices/:id/send-reminder", async (req, reply) => {
    if (!/^\d{1,9}$/.test(req.params.id)) return reply.code(404).send({ error: "Invoice not found" });
    const out = await sendNextReminder(deps, Number(req.params.id));
    switch (out.kind) {
      case "not_found":
        return reply.code(404).send({ error: "Invoice not found" });
      case "conflict":
        return reply.code(409).send({ error: out.error });
      case "failed":
        return reply.code(502).send({ error: "Email delivery failed", reminder: out.reminder });
      case "sent":
        return reply.code(201).send({ reminder: out.reminder });
    }
  });
}
