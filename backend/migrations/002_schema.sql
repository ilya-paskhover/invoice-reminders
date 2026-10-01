CREATE TABLE IF NOT EXISTS invoices (
  id serial PRIMARY KEY,
  number text NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  issue_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  paid_at timestamptz NULL,
  paid_via text NULL CHECK (paid_via IN ('manual','pay_link')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','mock_stripe')),
  external_id text NULL,
  pay_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id serial PRIMARY KEY,
  name text NOT NULL,
  offset_days integer NOT NULL CHECK (offset_days BETWEEN 1 AND 365),
  subject_template text NOT NULL,
  body_template text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id serial PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  rule_id integer NULL REFERENCES reminder_rules(id) ON DELETE SET NULL,
  rule_name text NOT NULL,
  rule_offset_days integer NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('scheduled','manual')),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  error text NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_invoice_idx ON reminders(invoice_id);
