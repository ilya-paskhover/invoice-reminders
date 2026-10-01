import nodemailer, { type Transporter } from "nodemailer";
import type { EmailSender } from "./types";

export interface SmtpOptions {
  host: string;
  port: number;
  user?: string | undefined;
  pass?: string | undefined;
}

export class SmtpEmailSender implements EmailSender {
  private transport: Transporter;

  constructor(opts: SmtpOptions) {
    this.transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: false,
      ignoreTLS: !opts.user,
      auth: opts.user ? { user: opts.user, pass: opts.pass ?? "" } : undefined,
    });
  }

  async send(msg: { to: string; from: string; subject: string; text: string }): Promise<void> {
    await this.transport.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
    });
  }
}
