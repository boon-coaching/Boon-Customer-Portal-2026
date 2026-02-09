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
-- PERMANENT FIX: Create RPC function for merging employees
-- This function runs with SECURITY DEFINER to bypass RLS
-- =============================================

CREATE OR REPLACE FUNCTION merge_duplicate_employees(
  keep_employee_id BIGINT,
  delete_employee_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  sessions_updated INT;
  scale_updated INT;
  baseline_updated INT;
BEGIN
  -- Reassign sessions
  UPDATE session_tracking
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;
  GET DIAGNOSTICS sessions_updated = ROW_COUNT;

  -- Reassign welcome_survey_scale
  UPDATE welcome_survey_scale
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;
  GET DIAGNOSTICS scale_updated = ROW_COUNT;

  -- Reassign welcome_survey_baseline
  UPDATE welcome_survey_baseline
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;
  GET DIAGNOSTICS baseline_updated = ROW_COUNT;

  -- Delete the duplicate employee
  DELETE FROM employee_manager
  WHERE id = delete_employee_id;

  result := jsonb_build_object(
    'success', true,
    'sessions_updated', sessions_updated,
    'scale_updated', scale_updated,
    'baseline_updated', baseline_updated
  );

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
