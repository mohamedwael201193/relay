-- Persist Shannon market asset on each lap so the tape does not
-- fall back to BTC after the window drops off the live list.

ALTER TABLE laps ADD COLUMN IF NOT EXISTS asset text;
ALTER TABLE laps ADD COLUMN IF NOT EXISTS interval_sec text;
