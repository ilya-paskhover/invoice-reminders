CREATE TABLE IF NOT EXISTS demo_state (
  id integer PRIMARY KEY CHECK (id = 1),
  last_reset_on date NOT NULL,
  last_reset_at timestamptz NOT NULL
);
