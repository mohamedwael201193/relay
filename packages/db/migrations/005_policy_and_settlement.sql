-- Runner policy (bias / cadence / assets) and one settlement per lap.

ALTER TABLE runners ADD COLUMN IF NOT EXISTS bias text NOT NULL DEFAULT 'FOLLOW';
ALTER TABLE runners ADD COLUMN IF NOT EXISTS interval_sec text NOT NULL DEFAULT '60';
ALTER TABLE runners ADD COLUMN IF NOT EXISTS assets text[] NOT NULL DEFAULT '{BTC,ETH}';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind text;

-- Keep the oldest settlement per lap, then enforce uniqueness so worker
-- retries cannot insert a second row and double-count money/streaks.
DELETE FROM settlements
WHERE id NOT IN (
  SELECT DISTINCT ON (lap_id) id
  FROM settlements
  ORDER BY lap_id, created_at ASC, id ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS settlements_lap_id_uidx ON settlements (lap_id);
