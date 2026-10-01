import type { FastifyInstance } from "fastify";
import type { Scheduler } from "../reminders/scheduler";

export function registerSchedulerRoutes(app: FastifyInstance, scheduler: Scheduler): void {
  app.get("/api/scheduler", async () => scheduler.status());
}
