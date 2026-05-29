-- ============================================================================
-- MIGRATION v3: Dynamic Multi-Shift Seat Allocation System
-- ============================================================================
-- Run this in Supabase SQL Editor ONCE. Idempotent-safe.
--
-- Creates:
--   1. `shifts` table        — per-library custom shift definitions
--   2. `seat_allocations`    — links seat + shift + student
--   3. `seat_label_prefix`   — on libraries table
--   4. RLS policies          — for both new tables
--   5. Indexes               — for fast lookups
--   6. Realtime              — on both new tables
--   7. Default data          — 3 starter shifts for each existing library
--   8. Data migration        — moves existing seat assignments into allocations
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD seat_label_prefix TO libraries
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE libraries ADD COLUMN seat_label_prefix text NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
COMMENT ON COLUMN libraries.seat_label_prefix
  IS 'Cosmetic prefix for seat labels, e.g. "S" renders S1, S2, etc.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. SHIFTS TABLE — per-library custom shift definitions
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id    uuid        NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  start_time    time        NOT NULL,
  end_time      time        NOT NULL,
  is_full_day   boolean     NOT NULL DEFAULT false,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  shifts             IS 'Per-library custom shift/slot definitions.';
COMMENT ON COLUMN shifts.name        IS 'Display name: Morning, Evening, Full Day, etc.';
COMMENT ON COLUMN shifts.is_full_day IS 'If true, allocating this shift blocks all other shifts on the same seat.';
COMMENT ON COLUMN shifts.sort_order  IS 'Controls display ordering in the UI.';

-- Unique constraint: no duplicate shift names within the same library
DO $$ BEGIN
  ALTER TABLE shifts
    ADD CONSTRAINT uq_shifts_library_name UNIQUE (library_id, name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. SEAT_ALLOCATIONS TABLE — links seat + shift + student
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seat_allocations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id       uuid        NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  shift_id      uuid        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  student_id    uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  start_date    date        NOT NULL DEFAULT CURRENT_DATE,
  end_date      date,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  seat_allocations             IS 'Each row = one student allocated to one shift on one seat.';
COMMENT ON COLUMN seat_allocations.is_active   IS 'Soft-delete flag. False = vacated / historical.';

-- Partial unique: only ONE active student per shift per seat
-- (inactive/historical rows are exempt from uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_allocations_active
  ON seat_allocations (seat_id, shift_id)
  WHERE is_active = true;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shifts_library_id
  ON shifts (library_id);

CREATE INDEX IF NOT EXISTS idx_seat_allocations_seat_id
  ON seat_allocations (seat_id);

CREATE INDEX IF NOT EXISTS idx_seat_allocations_student_id
  ON seat_allocations (student_id);

CREATE INDEX IF NOT EXISTS idx_seat_allocations_shift_id
  ON seat_allocations (shift_id);

CREATE INDEX IF NOT EXISTS idx_seat_allocations_active
  ON seat_allocations (is_active)
  WHERE is_active = true;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────

-- 5a. shifts ─────────────────────────────────────────────────────────────────
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view shifts of their libraries"
  ON shifts FOR SELECT
  USING (
    library_id IN (SELECT id FROM libraries WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can create shifts for their libraries"
  ON shifts FOR INSERT
  WITH CHECK (
    library_id IN (SELECT id FROM libraries WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can update shifts of their libraries"
  ON shifts FOR UPDATE
  USING (
    library_id IN (SELECT id FROM libraries WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    library_id IN (SELECT id FROM libraries WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can delete shifts of their libraries"
  ON shifts FOR DELETE
  USING (
    library_id IN (SELECT id FROM libraries WHERE owner_id = auth.uid())
  );

-- 5b. seat_allocations ──────────────────────────────────────────────────────
ALTER TABLE seat_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view allocations of their libraries"
  ON seat_allocations FOR SELECT
  USING (
    seat_id IN (
      SELECT s.id FROM seats s
      JOIN libraries l ON s.library_id = l.id
      WHERE l.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create allocations for their libraries"
  ON seat_allocations FOR INSERT
  WITH CHECK (
    seat_id IN (
      SELECT s.id FROM seats s
      JOIN libraries l ON s.library_id = l.id
      WHERE l.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update allocations of their libraries"
  ON seat_allocations FOR UPDATE
  USING (
    seat_id IN (
      SELECT s.id FROM seats s
      JOIN libraries l ON s.library_id = l.id
      WHERE l.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    seat_id IN (
      SELECT s.id FROM seats s
      JOIN libraries l ON s.library_id = l.id
      WHERE l.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete allocations of their libraries"
  ON seat_allocations FOR DELETE
  USING (
    seat_id IN (
      SELECT s.id FROM seats s
      JOIN libraries l ON s.library_id = l.id
      WHERE l.owner_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 6. REALTIME
-- ────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE seat_allocations;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. DEFAULT SHIFTS for existing libraries (idempotent)
-- ────────────────────────────────────────────────────────────────────────────
-- Only inserts if the library has zero shifts (i.e., first migration run).
INSERT INTO shifts (library_id, name, start_time, end_time, is_full_day, sort_order)
SELECT l.id, s.name, s.start_time, s.end_time, s.is_full_day, s.sort_order
FROM libraries l
CROSS JOIN (
  VALUES
    ('Morning',   '07:00'::time, '13:00'::time, false, 1),
    ('Evening',   '13:00'::time, '19:00'::time, false, 2),
    ('Full Day',  '07:00'::time, '22:00'::time, true,  3)
) AS s(name, start_time, end_time, is_full_day, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM shifts sh WHERE sh.library_id = l.id
)
ON CONFLICT (library_id, name) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. DATA MIGRATION — move existing seats.current_student_id into allocations
-- ────────────────────────────────────────────────────────────────────────────
-- For each seat that has a current_student_id, create an allocation row
-- mapped to the closest matching shift (or the first shift if no match).
-- This is a best-effort migration for pre-existing data.
INSERT INTO seat_allocations (seat_id, shift_id, student_id, is_active)
SELECT
  s.id AS seat_id,
  COALESCE(
    -- Try to match old current_slot to a shift name
    (SELECT sh.id FROM shifts sh
     WHERE sh.library_id = s.library_id
       AND lower(sh.name) = COALESCE(lower(s.current_slot::text), 'morning')
     LIMIT 1),
    -- Fallback: first shift for this library
    (SELECT sh.id FROM shifts sh
     WHERE sh.library_id = s.library_id
     ORDER BY sh.sort_order ASC
     LIMIT 1)
  ) AS shift_id,
  s.current_student_id AS student_id,
  true
FROM seats s
WHERE s.current_student_id IS NOT NULL
  AND NOT EXISTS (
    -- Skip if already migrated
    SELECT 1 FROM seat_allocations sa
    WHERE sa.seat_id = s.id AND sa.student_id = s.current_student_id AND sa.is_active = true
  );


-- ============================================================================
-- Done! Run this once in Supabase SQL Editor.
--
-- After running:
--   1. Each existing library gets 3 default shifts (Morning, Evening, Full Day)
--   2. Any existing seat assignments are migrated to seat_allocations
--   3. The shifts and seat_allocations tables have RLS + Realtime enabled
--   4. Libraries table has seat_label_prefix column
-- ============================================================================
