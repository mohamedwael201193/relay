-- Worker leases. Chain remains financial truth.

ALTER TABLE runners ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE runners ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE runners ADD COLUMN IF NOT EXISTS last_market_id text;
ALTER TABLE runners ADD COLUMN IF NOT EXISTS lap_index integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id uuid NOT NULL REFERENCES runners(id),
  lap_id uuid REFERENCES laps(id),
  kind text NOT NULL,
  tx_hash text,
  fill_class text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_records_runner_idx ON verification_records (runner_id, created_at);
