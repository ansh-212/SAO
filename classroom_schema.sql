-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- InterviewVault — Classroom Engine Schema (Supabase / PostgreSQL)
-- Compatible with Supabase Auth (auth.users) and Row Level Security (RLS)
-- Run in Supabase SQL Editor or via psql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Helper: generate random 6-char alphanumeric code ──────────────────────
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars (O/0, I/1)
  i     INT;
BEGIN
  code := '';
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: classrooms
-- Owned by an admin (teacher). Generates a unique 6-char class_code.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                          -- e.g. "Network Engineering — Sem 5"
  description TEXT,
  class_code  TEXT NOT NULL UNIQUE DEFAULT generate_class_code(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classrooms_updated_at
  BEFORE UPDATE ON classrooms
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Index for fast class_code lookups (join flow)
CREATE INDEX IF NOT EXISTS idx_classrooms_code ON classrooms (class_code);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: classroom_members
-- Links students to classrooms via the class_code join mechanism.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS classroom_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (classroom_id, student_id)             -- student can only join once
);

CREATE INDEX IF NOT EXISTS idx_members_classroom ON classroom_members (classroom_id);
CREATE INDEX IF NOT EXISTS idx_members_student   ON classroom_members (student_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: classroom_assessments
-- Admins publish existing assessments to specific classrooms.
-- Students in that classroom can then query and take those assessments.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS classroom_assessments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id   UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  assessment_id  INT  NOT NULL,                  -- FK to existing assessments table (int PK)
  published_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at         TIMESTAMPTZ,                    -- optional deadline
  UNIQUE (classroom_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_classroom  ON classroom_assessments (classroom_id);
CREATE INDEX IF NOT EXISTS idx_ca_assessment ON classroom_assessments (assessment_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: submissions  (enriched with classroom context)
-- When a student submits, classroom_id is recorded for real-time
-- admin monitoring via Supabase Realtime subscriptions.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- If you already have a submissions table, run only the ALTER below:
-- ALTER TABLE submissions ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id);

-- Full table definition (use if starting fresh):
CREATE TABLE IF NOT EXISTS submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id   INT  NOT NULL,
  classroom_id    UUID REFERENCES classrooms(id) ON DELETE SET NULL,  -- nullable for direct submissions
  answers         JSONB NOT NULL DEFAULT '{}',
  score           NUMERIC(5,2),                  -- 0.00 - 100.00
  feedback        TEXT,
  depth_score     NUMERIC(4,2),
  originality     NUMERIC(4,2),
  bloom_levels    JSONB,                          -- e.g. {"remember":2,"analyze":5}
  certificate_url TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_submissions_student    ON submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_classroom  ON submissions (classroom_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assessment ON submissions (assessment_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROW LEVEL SECURITY (RLS)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Enable RLS
ALTER TABLE classrooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions         ENABLE ROW LEVEL SECURITY;

-- classrooms: admin can CRUD their own; students can SELECT active classrooms they're in
CREATE POLICY "Admin manages own classrooms" ON classrooms
  FOR ALL USING (admin_id = auth.uid());

CREATE POLICY "Student reads enrolled classrooms" ON classrooms
  FOR SELECT USING (
    id IN (SELECT classroom_id FROM classroom_members WHERE student_id = auth.uid())
    AND is_active = TRUE
  );

-- classroom_members: admin reads members of their classrooms; students manage their own membership
CREATE POLICY "Admin reads members" ON classroom_members
  FOR SELECT USING (
    classroom_id IN (SELECT id FROM classrooms WHERE admin_id = auth.uid())
  );

CREATE POLICY "Student joins/reads own membership" ON classroom_members
  FOR ALL USING (student_id = auth.uid());

-- classroom_assessments: admin manages; students read if they're a member
CREATE POLICY "Admin manages assessments" ON classroom_assessments
  FOR ALL USING (
    classroom_id IN (SELECT id FROM classrooms WHERE admin_id = auth.uid())
  );

CREATE POLICY "Student reads classroom assessments" ON classroom_assessments
  FOR SELECT USING (
    classroom_id IN (SELECT classroom_id FROM classroom_members WHERE student_id = auth.uid())
  );

-- submissions: students own their submissions; admin reads submissions from their classrooms
CREATE POLICY "Student manages own submissions" ON submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Admin reads classroom submissions" ON submissions
  FOR SELECT USING (
    classroom_id IN (SELECT id FROM classrooms WHERE admin_id = auth.uid())
  );

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- USEFUL VIEWS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Admin view: classrooms with member count
CREATE OR REPLACE VIEW v_classrooms_overview AS
SELECT
  c.*,
  COUNT(DISTINCT cm.student_id)::INT  AS member_count,
  COUNT(DISTINCT ca.assessment_id)::INT AS assessment_count
FROM classrooms c
LEFT JOIN classroom_members    cm ON cm.classroom_id = c.id
LEFT JOIN classroom_assessments ca ON ca.classroom_id = c.id
GROUP BY c.id;

-- Admin: real-time submissions feed per classroom
CREATE OR REPLACE VIEW v_classroom_submissions AS
SELECT
  s.id,
  s.classroom_id,
  s.assessment_id,
  s.student_id,
  u.email  AS student_email,
  s.score,
  s.depth_score,
  s.originality,
  s.submitted_at
FROM submissions s
JOIN auth.users u ON u.id = s.student_id
WHERE s.classroom_id IS NOT NULL
ORDER BY s.submitted_at DESC;

-- Enable Supabase Realtime on submissions for admin dashboard live updates:
-- (Run in Supabase dashboard → Database → Replication → Enable for `submissions`)
