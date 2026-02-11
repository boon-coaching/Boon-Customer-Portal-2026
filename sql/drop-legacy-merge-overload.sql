-- Drop all overloads of merge_duplicate_employees
-- The fix-merge-function.sql script handles this, but this file
-- can be run standalone if needed.
--
-- employee_manager.id is BIGINT, so only the BIGINT version should exist.

DROP FUNCTION IF EXISTS merge_duplicate_employees(UUID, UUID);
DROP FUNCTION IF EXISTS merge_duplicate_employees(BIGINT, BIGINT);
