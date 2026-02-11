-- Secure version of merge_duplicate_employees
-- Adds authorization checks before performing the merge
--
-- NOTE: employee_manager.id is BIGINT, so this function accepts BIGINT parameters.
--
-- Changes from original:
-- 1. SET search_path = public (prevents search_path hijacking)
-- 2. Authorization: caller must be authenticated
-- 3. Authorization: caller must be admin OR belong to the same company
-- 4. Validates both employee IDs exist
-- 5. Validates both employees belong to the same company
-- 6. Also updates survey_submissions (was missing from original)
-- 7. REVOKE/GRANT to restrict to authenticated users only

-- First, drop any existing overloads to avoid "function is not unique" errors
DROP FUNCTION IF EXISTS merge_duplicate_employees(UUID, UUID);
DROP FUNCTION IF EXISTS merge_duplicate_employees(BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION merge_duplicate_employees(
  keep_employee_id BIGINT,
  delete_employee_id BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_company_id TEXT;
  delete_company_id TEXT;
  caller_company_id TEXT;
  caller_role TEXT;
  affected_sessions INT;
  affected_surveys INT;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Get caller's company_id and role from JWT
  caller_company_id := auth.jwt()->'app_metadata'->>'company_id';
  caller_role := auth.jwt()->'app_metadata'->>'role';

  -- 3. Validate both employees exist and get their company_ids
  SELECT company_id::TEXT INTO keep_company_id
  FROM employee_manager WHERE id = keep_employee_id;

  IF keep_company_id IS NULL THEN
    RAISE EXCEPTION 'Employee to keep (%) not found', keep_employee_id;
  END IF;

  SELECT company_id::TEXT INTO delete_company_id
  FROM employee_manager WHERE id = delete_employee_id;

  IF delete_company_id IS NULL THEN
    RAISE EXCEPTION 'Employee to delete (%) not found', delete_employee_id;
  END IF;

  -- 4. Verify both employees belong to the same company
  IF keep_company_id != delete_company_id THEN
    RAISE EXCEPTION 'Cannot merge employees from different companies';
  END IF;

  -- 5. Authorization: caller must be admin OR belong to the same company
  IF caller_role != 'admin' AND caller_company_id != keep_company_id THEN
    RAISE EXCEPTION 'Access denied: you can only merge employees in your own company';
  END IF;

  -- 6. Perform the merge: update references in related tables
  UPDATE session_tracking
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;
  GET DIAGNOSTICS affected_sessions = ROW_COUNT;

  UPDATE welcome_survey_scale
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;

  UPDATE welcome_survey_baseline
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;

  UPDATE survey_submissions
  SET employee_id = keep_employee_id
  WHERE employee_id = delete_employee_id;
  GET DIAGNOSTICS affected_surveys = ROW_COUNT;

  -- 7. Delete the duplicate employee record
  DELETE FROM employee_manager WHERE id = delete_employee_id;

  -- 8. Return summary
  RETURN jsonb_build_object(
    'success', true,
    'kept_employee_id', keep_employee_id,
    'deleted_employee_id', delete_employee_id,
    'sessions_updated', affected_sessions,
    'surveys_updated', affected_surveys
  );
END;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION merge_duplicate_employees(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_duplicate_employees(BIGINT, BIGINT) TO authenticated;
