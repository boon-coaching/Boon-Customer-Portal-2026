-- Fix employee duplicate merge for Eric Morgenstern
-- Run this in Supabase SQL Editor

-- Step 1: Find the two duplicate employees
SELECT id, first_name, last_name, company_email, status
FROM employee_manager
WHERE LOWER(last_name) = 'morgenstern'
  AND LOWER(first_name) = 'eric';

-- Step 2: Check what records exist in welcome_survey_scale for these employees
-- (Replace the IDs with actual values from Step 1)
SELECT id, email, employee_id, program_title
FROM welcome_survey_scale
WHERE employee_id IN (
  SELECT id FROM employee_manager
  WHERE LOWER(last_name) = 'morgenstern' AND LOWER(first_name) = 'eric'
)
OR LOWER(email) LIKE '%morgenstern%';

-- Step 3: Find the employee IDs
-- Run this to get the exact IDs:
SELECT
  id,
  company_email,
  CASE WHEN company_email LIKE '%@eldridge.com' THEN 'KEEP' ELSE 'DELETE' END as action
FROM employee_manager
WHERE LOWER(last_name) = 'morgenstern' AND LOWER(first_name) = 'eric';

-- =============================================
-- STEP 4: EXECUTE THE FIX
-- Uncomment and update the IDs below after running the queries above
-- =============================================

-- Replace KEEP_ID and DELETE_ID with actual values from Step 3

-- -- Update welcome_survey_scale to point to the kept employee
-- UPDATE welcome_survey_scale
-- SET employee_id = KEEP_ID
-- WHERE employee_id = DELETE_ID;

-- -- Update session_tracking to point to the kept employee
-- UPDATE session_tracking
-- SET employee_id = KEEP_ID
-- WHERE employee_id = DELETE_ID;

-- -- Update welcome_survey_baseline if needed
-- UPDATE welcome_survey_baseline
-- SET employee_id = KEEP_ID
-- WHERE employee_id = DELETE_ID;

-- -- Finally, delete the duplicate employee
-- DELETE FROM employee_manager
-- WHERE id = DELETE_ID;

-- -- Verify the fix
-- SELECT id, first_name, last_name, company_email
-- FROM employee_manager
-- WHERE LOWER(last_name) = 'morgenstern';


-- =============================================
-- LEGACY: This BIGINT function has been superseded by the UUID version
-- in sql/fix-merge-function.sql. Do NOT run this section.
-- If both overloads exist, Supabase RPC calls fail with
-- "function is not unique" error.
-- To remove the legacy overload, run: sql/drop-legacy-merge-overload.sql
-- =============================================
