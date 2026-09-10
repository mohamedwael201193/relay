-- On-chain streak shields: a consumed shield keeps the run without counting as a break.
ALTER TABLE laps ADD COLUMN IF NOT EXISTS shielded boolean NOT NULL DEFAULT false;
