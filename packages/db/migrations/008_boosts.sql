-- On-chain BoostController provenance, mirrored in Postgres for arena.
-- Chain remains financial truth; this table is the public boost graph.

CREATE TABLE IF NOT EXISTS boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_vault text NOT NULL,
  child_vault text NOT NULL,
  owner text NOT NULL,
  config_hash text,
  budget text,
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_vault)
);

CREATE INDEX IF NOT EXISTS boosts_leader_idx ON boosts (leader_vault);
CREATE INDEX IF NOT EXISTS boosts_created_idx ON boosts (created_at DESC);
