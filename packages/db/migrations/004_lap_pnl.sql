-- Persist collateral-raw entry cost, redeem inflow, and signed PnL per lap.

ALTER TABLE laps ADD COLUMN IF NOT EXISTS entry_cost text;
ALTER TABLE laps ADD COLUMN IF NOT EXISTS redeem_value text;
ALTER TABLE laps ADD COLUMN IF NOT EXISTS pnl text;
