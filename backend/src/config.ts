export interface Config {
  port: number;
  databaseUrl: string;
  emailProvider: "smtp" | "memory";
  smtpHost: string;
  smtpPort: number;
  smtpUser: string | undefined;
  smtpPass: string | undefined;
  fromEmail: string;
  businessName: string;
  publicApiUrl: string;
  webOrigin: string;
  schedulerIntervalSeconds: number;
  demoMode: boolean;
  demoResetCheckSeconds: number;
  dbCreateIfMissing: boolean;
}

function flag(v: string | undefined): boolean {
  return v === "true" || v === "1";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 4000),
    databaseUrl:
      env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:15432/invoice_reminders",
    emailProvider: env.EMAIL_PROVIDER === "memory" ? "memory" : "smtp",
    smtpHost: env.SMTP_HOST ?? "127.0.0.1",
    smtpPort: Number(env.SMTP_PORT ?? 11025),
    smtpUser: env.SMTP_USER || undefined,
    smtpPass: env.SMTP_PASS || undefined,
    fromEmail: env.FROM_EMAIL ?? "Demo Studio <billing@demo-studio.test>",
    businessName: env.BUSINESS_NAME ?? "Demo Studio",
    publicApiUrl: env.PUBLIC_API_URL ?? "http://localhost:14000",
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:13000",
    schedulerIntervalSeconds: Number(env.SCHEDULER_INTERVAL_SECONDS ?? 3600),
    demoMode: flag(env.DEMO_MODE),
    demoResetCheckSeconds: Number(env.DEMO_RESET_CHECK_SECONDS ?? 900),
    dbCreateIfMissing: flag(env.DB_CREATE_IF_MISSING),
  };
}
