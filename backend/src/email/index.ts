import type { Config } from "../config";
import type { EmailSender } from "./types";
import { MemoryEmailSender } from "./memory";
import { SmtpEmailSender } from "./smtp";
import { DemoEmailSender } from "./demo";

export function createEmailSender(config: Config): EmailSender {
  if (config.demoMode) return new DemoEmailSender();
  if (config.emailProvider === "memory") return new MemoryEmailSender();
  return new SmtpEmailSender({
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    pass: config.smtpPass,
  });
}
