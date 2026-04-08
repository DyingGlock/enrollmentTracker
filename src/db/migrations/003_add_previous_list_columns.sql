ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS previous_list_id TEXT,
  ADD COLUMN IF NOT EXISTS previous_list_name TEXT;
