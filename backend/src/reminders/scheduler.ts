import { runDueReminders, type EngineDeps } from "./engine";
import { todayUtc } from "../dates";

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastRunAt: Date | null = null;
  private nextRunAt: Date | null = null;
  private lastResult: { sent: number; failed: number } | null = null;

  constructor(private deps: EngineDeps) {}

  get intervalSeconds(): number {
    return this.deps.config.schedulerIntervalSeconds;
  }

  get enabled(): boolean {
    return this.intervalSeconds > 0;
  }

  /** Starts the interval; the first tick happens one interval from now. No-op when disabled. */
  start(): void {
    if (!this.enabled || this.timer) return;
    const ms = this.intervalSeconds * 1000;
    this.nextRunAt = new Date(Date.now() + ms);
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error("scheduler tick failed", err));
    }, ms);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.nextRunAt = null;
  }

  async tick(): Promise<{ sent: number; failed: number }> {
    let result = { sent: 0, failed: 0 };
    try {
      const res = await runDueReminders(this.deps, todayUtc());
      result = { sent: res.sent, failed: res.failed };
      this.lastResult = result;
    } finally {
      this.lastRunAt = new Date();
      if (this.timer) this.nextRunAt = new Date(Date.now() + this.intervalSeconds * 1000);
    }
    return result;
  }

  status() {
    return {
      enabled: this.enabled,
      interval_seconds: this.intervalSeconds,
      last_run_at: this.lastRunAt ? this.lastRunAt.toISOString() : null,
      next_run_at: this.nextRunAt ? this.nextRunAt.toISOString() : null,
      last_result: this.lastResult,
    };
  }
}
