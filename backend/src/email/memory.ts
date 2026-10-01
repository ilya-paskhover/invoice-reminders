import type { EmailSender } from "./types";

export type SentMessage = { to: string; from: string; subject: string; text: string };

export class MemoryEmailSender implements EmailSender {
  sent: SentMessage[] = [];
  failing = false;
  failMessage = "Simulated email failure";

  setFailing(value: boolean): void {
    this.failing = value;
  }

  async send(msg: SentMessage): Promise<void> {
    if (this.failing) throw new Error(this.failMessage);
    this.sent.push({ ...msg });
  }
}
