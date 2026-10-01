import { describe, expect, it } from "vitest";
import { SmtpEmailSender } from "../src/email/smtp";

const host = process.env.TEST_SMTP_HOST ?? "127.0.0.1";
const port = Number(process.env.TEST_SMTP_PORT ?? 11025);
const api = process.env.TEST_MAILPIT_API ?? "http://127.0.0.1:18025";

describe("SmtpEmailSender via Mailpit", () => {
  it("delivers a message that appears in the Mailpit API", async () => {
    const subject = `smtp-test ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sender = new SmtpEmailSender({ host, port });
    await sender.send({
      to: "client@example.test",
      from: "Demo Studio <billing@demo-studio.test>",
      subject,
      text: "Hello from the SMTP test",
    });
    const deadline = Date.now() + 5000;
    let found: any;
    while (Date.now() < deadline && !found) {
      const res = await fetch(`${api}/api/v1/messages`);
      const data: any = await res.json();
      found = (data.messages ?? []).find((m: any) => m.Subject === subject);
      if (!found) await new Promise((r) => setTimeout(r, 250));
    }
    expect(found).toBeTruthy();
    expect(found.To[0].Address).toBe("client@example.test");
  });
});
