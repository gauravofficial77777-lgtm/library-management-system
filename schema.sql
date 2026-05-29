-- ============================================================================
-- LIBRARY MANAGEMENT SYSTEM — Supabase (PostgreSQL) Schema
-- ============================================================================
-- Run this file once in the Supabase SQL Editor (or via psql/migration).
-- It is idempotent-safe: every CREATE uses IF NOT EXISTS or CREATE OR REPLACE.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CUSTOM ENUM TYPES
-- ────────────────────────────────────────────────────────────────────────────

-- Slots represent the time-window a student has booked a seat for.
DO $$ BEGIN
  CREATE TYPE slot_type AS ENUM ('morning', 'evening', 'night', 'full', 'half');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tracks whether a physical seat is usable, in-use, or under maintenance.
DO $$ BEGIN
  CREATE TYPE seat_status AS ENUM ('occupied', 'vacant', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. TABLES
-- ────────────────────────────────────────────────────────────────────────────
-- Note: `seats` and `students` reference each other (circular FK).
-- We create the tables first WITHOUT the cross-references, then add them
-- via ALTER TABLE so PostgreSQL can resolve both tables.
-- ────────────────────────────────────────────────────────────────────────────


-- 2a. libraries ─────────────────────────────────────────────────────────────
-- Each row represents one physical library location owned by a SaaS user.
CREATE TABLE IF NOT EXISTS libraries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  owner_id    uuid        NOT NULL REFERENCES auth.users (id),
  total_seats integer     NOT NULL DEFAULT 30,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  libraries              IS 'A library location managed by a SaaS owner.';
COMMENT ON COLUMN libraries.owner_id     IS 'FK → auth.users. The authenticated user who owns this library.';
COMMENT ON COLUMN libraries.total_seats  IS 'How many seats to auto-create when the library row is inserted.';


-- 2b. seats ─────────────────────────────────────────────────────────────────
-- Each row is a single bookable seat inside a library.
-- current_student_id will be added after the students table exists.
CREATE TABLE IF NOT EXISTS seats (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_number         integer     NOT NULL,
  library_id          uuid        NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
  current_student_id  uuid,                        -- FK added below after students exists
  current_slot        slot_type,                    -- NULL when vacant
  status              seat_status NOT NULL DEFAULT 'vacant',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  seats                        IS 'Physical seats inside a library.';
COMMENT ON COLUMN seats.current_student_id     IS 'The student currently occupying this seat (nullable).';
COMMENT ON COLUMN seats.current_slot           IS 'Which time-slot the seat is booked for (NULL = vacant).';
COMMENT ON COLUMN seats.status                 IS 'occupied / vacant / maintenance.';


-- 2c. students ──────────────────────────────────────────────────────────────
-- Students registered under a specific library.
-- seat_id will be added after seats table exists (already does, but kept
-- consistent with the pattern).
CREATE TABLE IF NOT EXISTS students (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  phone             text        NOT NULL,
  library_id        uuid        NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
  joined_date       date        NOT NULL DEFAULT CURRENT_DATE,
  fee_due_date      date,
  seat_id           uuid,                          -- FK added below
  preparation_field text        NOT NULL DEFAULT 'General',
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  students                   IS 'A student enrolled in a library.';
COMMENT ON COLUMN students.fee_due_date      IS 'Date by which the student must pay the next fee instalment.';
COMMENT ON COLUMN students.seat_id           IS 'The seat currently assigned to this student (nullable).';
COMMENT ON COLUMN students.preparation_field IS 'What the student is preparing for, e.g. UPSC, JEE, General.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2d. CIRCULAR FOREIGN KEYS (added via ALTER TABLE)
-- ────────────────────────────────────────────────────────────────────────────

-- seats.current_student_id → students.id  (SET NULL on delete)
DO $$ BEGIN
  ALTER TABLE seats
    ADD CONSTRAINT fk_seats_current_student
    FOREIGN KEY (current_student_id)
    REFERENCES students (id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- students.seat_id → seats.id  (SET NULL on delete)
DO $$ BEGIN
  ALTER TABLE students
    ADD CONSTRAINT fk_students_seat
    FOREIGN KEY (seat_id)
    REFERENCES seats (id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ────────────────────────────────────────────────────────────────────────────
-- Speed up the most common query pattern: "give me everything for MY library."

CREATE INDEX IF NOT EXISTS idx_seats_library_id
  ON seats (library_id);

CREATE INDEX IF NOT EXISTS idx_students_library_id
  ON students (library_id);

-- The libraries table is already looked up by owner_id in every RLS check.
CREATE INDEX IF NOT EXISTS idx_libraries_owner_id
  ON libraries (owner_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. UNIQUE CONSTRAINTS
-- ────────────────────────────────────────────────────────────────────────────
-- A seat number must be unique within its library.

DO $$ BEGIN
  ALTER TABLE seats
    ADD CONSTRAINT uq_seats_library_seat_number
    UNIQUE (library_id, seat_number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────────────────────
-- Policies follow the principle of least privilege.
-- The Supabase service_role key bypasses RLS automatically.
-- ────────────────────────────────────────────────────────────────────────────

-- 5a. libraries ─────────────────────────────────────────────────────────────
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;

-- Owners can read only their own library.
CREATE POLICY "Owners can view their own library"
  ON libraries FOR SELECT
  USING (owner_id = auth.uid());

-- Owners can insert a library for themselves.
CREATE POLICY "Owners can create a library"
  ON libraries FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Owners can update their own library details.
CREATE POLICY "Owners can update their own library"
  ON libraries FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Owners can delete their own library.
CREATE POLICY "Owners can delete their own library"
  ON libraries FOR DELETE
  USING (owner_id = auth.uid());


-- 5b. seats ─────────────────────────────────────────────────────────────────
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;

-- Helper: "does this seat belong to a library I own?"
-- Used as a sub-query in every seats policy.

CREATE POLICY "Owners can view seats of their libraries"
  ON seats FOR SELECT
  USING (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update seats of their libraries"
  ON seats FOR UPDATE
  USING (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  );

-- INSERT on seats is handled by the trigger (runs as SECURITY DEFINER).
-- If you also need manual inserts from the client, uncomment below:
-- CREATE POLICY "Owners can insert seats into their libraries"
--   ON seats FOR INSERT
--   WITH CHECK (
--     library_id IN (
--       SELECT id FROM libraries WHERE owner_id = auth.uid()
--     )
--   );


-- 5c. students ──────────────────────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view students of their libraries"
  ON students FOR SELECT
  USING (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert students into their libraries"
  ON students FOR INSERT
  WITH CHECK (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update students of their libraries"
  ON students FOR UPDATE
  USING (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete students from their libraries"
  ON students FOR DELETE
  USING (
    library_id IN (
      SELECT id FROM libraries WHERE owner_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGERS
-- ────────────────────────────────────────────────────────────────────────────

-- 6a. Auto-create seats when a new library is inserted ──────────────────────
-- Runs as SECURITY DEFINER so it can bypass RLS on the seats table.

CREATE OR REPLACE FUNCTION fn_auto_create_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- bypasses RLS so the insert into seats succeeds
SET search_path = public  -- prevent search_path injection
AS $$
BEGIN
  INSERT INTO seats (seat_number, library_id, status)
  SELECT
    generate_series(1, NEW.total_seats),
    NEW.id,
    'vacant'::seat_status;

  RETURN NEW;
END;
$$;

-- Drop + re-create keeps migrations idempotent.
DROP TRIGGER IF EXISTS trg_auto_create_seats ON libraries;

CREATE TRIGGER trg_auto_create_seats
  AFTER INSERT ON libraries
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_seats();

COMMENT ON FUNCTION fn_auto_create_seats()
  IS 'Automatically provisions N vacant seats when a library row is created.';


-- 6b. Auto-update `updated_at` on seats ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seats_updated_at ON seats;

CREATE TRIGGER trg_seats_updated_at
  BEFORE UPDATE ON seats
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON FUNCTION fn_set_updated_at()
  IS 'Generic helper: sets updated_at = now() before every UPDATE.';


-- ────────────────────────────────────────────────────────────────────────────
-- 7. SUPABASE REALTIME
-- ────────────────────────────────────────────────────────────────────────────
-- Broadcast row-level changes on the seats table to connected clients.
-- This lets a front-end dashboard show live seat availability.

ALTER PUBLICATION supabase_realtime ADD TABLE seats;


-- ============================================================================
-- Done! Your Library Management System schema is ready.
-- Next steps:
--   1. Paste this into the Supabase SQL Editor and click "Run".
--   2. Configure your .env.local with the project URL & keys.
--   3. Start building your Next.js / React front-end. 🚀
-- ============================================================================
