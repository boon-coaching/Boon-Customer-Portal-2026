-- Fix 72andSunny data in session_tracking table
-- All 72andSunny records should have:
--   account_name = '72andSunny'
--   company_id = '0e83dfa2-a79b-41d1-8765-5b4c2c9bf180'

-- =============================================
-- STEP 1: Preview what will be updated
-- =============================================

SELECT
  program_name,
  account_name,
  company_id,
  COUNT(*) as record_count
FROM session_tracking
WHERE program_name ILIKE '%72andSunny%'
GROUP BY program_name, account_name, company_id
ORDER BY program_name, account_name;

-- =============================================
-- STEP 2: Update session_tracking
-- =============================================

UPDATE session_tracking
SET
  account_name = '72andSunny',
  company_id = '0e83dfa2-a79b-41d1-8765-5b4c2c9bf180'
WHERE program_name ILIKE '%72andSunny%';

-- =============================================
-- STEP 3: Verify session_tracking fix
-- =============================================

SELECT
  program_name,
  account_name,
  company_id,
  COUNT(*) as record_count
FROM session_tracking
WHERE program_name ILIKE '%72andSunny%'
GROUP BY program_name, account_name, company_id
ORDER BY program_name;

-- =============================================
-- STEP 4: Preview employee_manager data
-- =============================================

SELECT
  program_title,
  company_name,
  company_id,
  COUNT(*) as employee_count
FROM employee_manager
WHERE program_title ILIKE '%72andSunny%'
   OR company_name ILIKE '%72andSunny%'
GROUP BY program_title, company_name, company_id
ORDER BY program_title, company_name;

-- =============================================
-- STEP 5: Update employee_manager
-- =============================================

UPDATE employee_manager
SET
  company_name = '72andSunny',
  company_id = '0e83dfa2-a79b-41d1-8765-5b4c2c9bf180'
WHERE program_title ILIKE '%72andSunny%'
   OR company_name ILIKE '%72andSunny%';

-- =============================================
-- STEP 6: Verify employee_manager fix
-- =============================================

SELECT
  program_title,
  company_name,
  company_id,
  COUNT(*) as employee_count
FROM employee_manager
WHERE program_title ILIKE '%72andSunny%'
   OR company_name ILIKE '%72andSunny%'
GROUP BY program_title, company_name, company_id
ORDER BY program_title;
