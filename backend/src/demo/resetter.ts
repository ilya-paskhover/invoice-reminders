import type pg from "pg";
import type { Config } from "../config";
import { checkAndResetIfStale } from "./reset";

export class DemoResetter {
  private timer: NodeJS.Timeout | null = null;

  constructor(private pool: pg.Pool, private config: Config) {}

  start(): void {
    const seconds = this.config.demoResetCheckSeconds;
    if (this.timer || !(seconds > 0)) return;
    this.timer = setInterval(() => {
      checkAndResetIfStale(this.pool, this.config).catch((err) => console.error("demo reset check failed", err));
    }, seconds * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
