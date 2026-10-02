import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { todayUtc } from "../dates";
import type { InvoiceSource } from "../sources/types";
import { importInvoices } from "../sources/import";

export function registerImportRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  source: InvoiceSource,
): void {
  app.post("/api/import/mock-stripe", async () => importInvoices(pool, source, todayUtc()));
}
