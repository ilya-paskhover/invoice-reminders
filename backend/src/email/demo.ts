import type { EmailSender } from "./types";

/** Demo mode sender: logs one line, keeps nothing, never delivers. */
export class DemoEmailSender implements EmailSender {
  async send(msg: { to: string; from: string; subject: string; text: string }): Promise<void> {
    console.log(`demo mode: email to ${msg.to} suppressed: ${msg.subject}`);
  }
}
