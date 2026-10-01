export interface EmailSender {
  send(msg: { to: string; from: string; subject: string; text: string }): Promise<void>;
}
