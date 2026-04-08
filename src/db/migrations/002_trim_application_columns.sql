ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS class_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS class_number INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER;

UPDATE applications
SET class_label = COALESCE(NULLIF(class_label, ''), 'Unknown Class')
WHERE class_label = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'applications'
      AND column_name = 'approved'
  ) THEN
    ALTER TABLE applications DROP COLUMN approved;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'applications'
      AND column_name = 'officer_assigned'
  ) THEN
    ALTER TABLE applications DROP COLUMN officer_assigned;
  END IF;
END $$;
