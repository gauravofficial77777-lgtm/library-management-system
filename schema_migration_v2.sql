-- ============================================================================
-- MIGRATION v2: Add missing columns to students table
-- ============================================================================
-- Run this in Supabase SQL Editor ONCE. It is idempotent-safe.
-- Adds: seat_number (TEXT), monthly_fee (INTEGER), fee_status (TEXT),
--        current_slot (TEXT)
-- ============================================================================

-- 1. seat_number — alphanumeric seat label (e.g., S4, M5, 12)
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN seat_number text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
COMMENT ON COLUMN students.seat_number IS 'Alphanumeric seat label assigned by the library owner (e.g., S4, M5, 12).';

-- 2. monthly_fee — custom per-student fee rate (e.g., 600, 800, 1200)
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN monthly_fee integer DEFAULT 500;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
COMMENT ON COLUMN students.monthly_fee IS 'Custom monthly fee rate set during admission. Defaults to 500.';

-- 3. fee_status — tracks whether the current month fee is paid or pending
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN fee_status text NOT NULL DEFAULT 'pending';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
COMMENT ON COLUMN students.fee_status IS 'Current payment status: pending or paid.';

-- 4. current_slot — stores the shift/slot directly on the student record
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN current_slot text DEFAULT 'morning';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
COMMENT ON COLUMN students.current_slot IS 'The shift timing assigned to this student (morning, afternoon, evening, full).';

-- 5. joining_date — rename joined_date to joining_date for frontend alignment
--    (We add joining_date as a new column and backfill from joined_date)
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN joining_date date DEFAULT CURRENT_DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Backfill joining_date from joined_date if it exists
UPDATE students SET joining_date = joined_date WHERE joining_date IS NULL AND joined_date IS NOT NULL;

-- 6. Index on fee_status for fast ledger queries
CREATE INDEX IF NOT EXISTS idx_students_fee_status ON students (fee_status);

-- 7. Enable realtime on students table for cross-page sync
ALTER PUBLICATION supabase_realtime ADD TABLE students;

-- ============================================================================
-- Done! Run this once in Supabase SQL Editor.
-- After running, the students table will have all columns the frontend needs.
-- ============================================================================
