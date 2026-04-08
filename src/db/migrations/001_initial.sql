CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  trello_card_id TEXT NOT NULL UNIQUE,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  class_label TEXT NOT NULL DEFAULT '',
  class_number INTEGER,
  attempt_number INTEGER,
  current_list_id TEXT NOT NULL,
  current_list_name TEXT NOT NULL,
  previous_list_id TEXT,
  previous_list_name TEXT,
  comments TEXT NOT NULL DEFAULT '',
  created_at_trello TIMESTAMPTZ,
  updated_at_trello TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_trello JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_applications_active
  ON applications (is_archived, current_list_name, updated_at_trello DESC);

CREATE INDEX IF NOT EXISTS idx_applications_board
  ON applications (board_id, is_archived);
