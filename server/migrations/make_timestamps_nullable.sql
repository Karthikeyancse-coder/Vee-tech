-- =========================================================
-- VEE-ALERT — articles table: make timestamp columns nullable
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =========================================================

-- triaged_at: NULL = "not yet AI-triaged" (valid pre-triage state)
ALTER TABLE articles ALTER COLUMN triaged_at DROP NOT NULL;

-- dispatched_at: NULL = "no alert was dispatched" (valid, most articles don't trigger alerts)
ALTER TABLE articles ALTER COLUMN dispatched_at DROP NOT NULL;

-- Verify the change
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'articles'
  AND column_name IN ('triaged_at', 'dispatched_at')
ORDER BY column_name;
