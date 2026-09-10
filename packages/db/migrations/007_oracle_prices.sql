-- Window open/close underlying prices from DreamDEX oracle answers (human USD).
ALTER TABLE laps ADD COLUMN IF NOT EXISTS open_price text;
ALTER TABLE laps ADD COLUMN IF NOT EXISTS close_price text;
ALTER TABLE laps ADD COLUMN IF NOT EXISTS oracle_question_id text;
