-- Drop the legacy BIGINT overload of merge_duplicate_employees
--
-- The database has two overloaded versions of this function:
--   1. merge_duplicate_employees(keep_employee_id BIGINT, delete_employee_id BIGINT) -- legacy
--   2. merge_duplicate_employees(keep_employee_id UUID, delete_employee_id UUID)    -- current
--
-- The employee_manager.id column is UUID, so the BIGINT version is obsolete.
-- Having both causes a "function is not unique" error when calling via Supabase RPC
-- because PostgreSQL cannot determine which overload to use.

DROP FUNCTION IF EXISTS merge_duplicate_employees(BIGINT, BIGINT);
