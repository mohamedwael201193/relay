-- RELAY persistence. Chain remains financial truth.

CREATE TABLE IF NOT EXISTS runners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault text NOT NULL,
  owner text NOT NULL,
  operator text NOT NULL,
  state text NOT NULL,
  chain_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, vault)
);

CREATE TABLE IF NOT EXISTS laps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id uuid NOT NULL REFERENCES runners(id),
  lap_index integer NOT NULL,
  market_id text NOT NULL,
  pool text,
  nonce text,
  state text NOT NULL,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (runner_id, lap_index)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lap_id uuid NOT NULL REFERENCES laps(id),
  attempt_id text NOT NULL,
  tx_hash text,
  order_id text,
  order_type integer,
  price text,
  quantity text,
  filled text,
  fill_class text NOT NULL,
  receipt_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lap_id uuid NOT NULL REFERENCES laps(id),
  market_id text NOT NULL,
  resolved boolean NOT NULL,
  voided boolean NOT NULL,
  payout_numerators text[] NOT NULL DEFAULT '{}',
  redeem_tx text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL UNIQUE,
  runner_id uuid REFERENCES runners(id),
  market_id text,
  pool text,
  attempt_id text,
  tx_hash text,
  state text NOT NULL,
  result text,
  error_category text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
