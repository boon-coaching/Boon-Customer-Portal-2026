-- ============================================
-- DUPLICATE CLEANUP SCRIPT FOR YEO & YEO
-- ============================================
-- Run each section separately in Supabase SQL Editor
-- ALWAYS run the SELECT first to review before DELETE

-- ============================================
-- STEP 1: IDENTIFY DUPLICATES (Review First!)
-- ============================================
-- This finds employees with same last name and similar first name
-- Shows which record would be KEPT vs DELETED

WITH duplicates AS (
  SELECT
    e1.id as keep_id,
    e1.first_name as keep_first,
    e1.last_name as keep_last,
    e1.company_email as keep_email,
    e1.department as keep_dept,
    e1.job_title as keep_title,
    e1.status as keep_status,
    e1.created_at as keep_created,
    e2.id as delete_id,
    e2.first_name as delete_first,
    e2.last_name as delete_last,
    e2.company_email as delete_email,
    e2.department as delete_dept,
    e2.job_title as delete_title,
    e2.status as delete_status,
    e2.created_at as delete_created
  FROM employee_manager e1
  JOIN employee_manager e2 ON
    LOWER(e1.last_name) = LOWER(e2.last_name)
    AND e1.id < e2.id  -- Avoid duplicate pairs and self-joins
    AND e1.company_name ILIKE '%Yeo%'
    AND e2.company_name ILIKE '%Yeo%'
  WHERE
    -- Same first name
    LOWER(e1.first_name) = LOWER(e2.first_name)
    -- OR one is prefix of other (Chris vs Christopher)
    OR LOWER(e1.first_name) LIKE LOWER(e2.first_name) || '%'
    OR LOWER(e2.first_name) LIKE LOWER(e1.first_name) || '%'
    -- OR common nicknames
    OR (LOWER(e1.first_name) IN ('chris', 'christopher') AND LOWER(e2.first_name) IN ('chris', 'christopher'))
    OR (LOWER(e1.first_name) IN ('mike', 'michael') AND LOWER(e2.first_name) IN ('mike', 'michael'))
    OR (LOWER(e1.first_name) IN ('bill', 'william', 'will') AND LOWER(e2.first_name) IN ('bill', 'william', 'will'))
    OR (LOWER(e1.first_name) IN ('bob', 'robert', 'rob') AND LOWER(e2.first_name) IN ('bob', 'robert', 'rob'))
    OR (LOWER(e1.first_name) IN ('jim', 'james', 'jimmy') AND LOWER(e2.first_name) IN ('jim', 'james', 'jimmy'))
    OR (LOWER(e1.first_name) IN ('joe', 'joseph', 'joey') AND LOWER(e2.first_name) IN ('joe', 'joseph', 'joey'))
    OR (LOWER(e1.first_name) IN ('dan', 'daniel', 'danny') AND LOWER(e2.first_name) IN ('dan', 'daniel', 'danny'))
    OR (LOWER(e1.first_name) IN ('matt', 'matthew') AND LOWER(e2.first_name) IN ('matt', 'matthew'))
    OR (LOWER(e1.first_name) IN ('tom', 'thomas', 'tommy') AND LOWER(e2.first_name) IN ('tom', 'thomas', 'tommy'))
    OR (LOWER(e1.first_name) IN ('ed', 'edward', 'eddie') AND LOWER(e2.first_name) IN ('ed', 'edward', 'eddie'))
    OR (LOWER(e1.first_name) IN ('nick', 'nicholas') AND LOWER(e2.first_name) IN ('nick', 'nicholas'))
    OR (LOWER(e1.first_name) IN ('alex', 'alexander') AND LOWER(e2.first_name) IN ('alex', 'alexander'))
    OR (LOWER(e1.first_name) IN ('ben', 'benjamin') AND LOWER(e2.first_name) IN ('ben', 'benjamin'))
    OR (LOWER(e1.first_name) IN ('sam', 'samuel') AND LOWER(e2.first_name) IN ('sam', 'samuel'))
    OR (LOWER(e1.first_name) IN ('tim', 'timothy') AND LOWER(e2.first_name) IN ('tim', 'timothy'))
    OR (LOWER(e1.first_name) IN ('tony', 'anthony') AND LOWER(e2.first_name) IN ('tony', 'anthony'))
    OR (LOWER(e1.first_name) IN ('jen', 'jennifer', 'jenny') AND LOWER(e2.first_name) IN ('jen', 'jennifer', 'jenny'))
    OR (LOWER(e1.first_name) IN ('liz', 'elizabeth', 'beth') AND LOWER(e2.first_name) IN ('liz', 'elizabeth', 'beth'))
    OR (LOWER(e1.first_name) IN ('kate', 'katherine', 'kathy', 'katie') AND LOWER(e2.first_name) IN ('kate', 'katherine', 'kathy', 'katie'))
    OR (LOWER(e1.first_name) IN ('pat', 'patricia', 'patty') AND LOWER(e2.first_name) IN ('pat', 'patricia', 'patty'))
    OR (LOWER(e1.first_name) IN ('maggie', 'margaret', 'meg') AND LOWER(e2.first_name) IN ('maggie', 'margaret', 'meg'))
)
SELECT
  keep_first || ' ' || keep_last as "KEEP",
  keep_email as "Keep Email",
  keep_dept as "Keep Dept",
  delete_first || ' ' || delete_last as "DELETE",
  delete_email as "Delete Email",
  delete_dept as "Delete Dept"
FROM duplicates
ORDER BY keep_last, keep_first;


-- ============================================
-- STEP 2: COUNT DUPLICATES
-- ============================================
-- Run this to see how many will be deleted

WITH duplicates AS (
  SELECT
    e2.id as delete_id
  FROM employee_manager e1
  JOIN employee_manager e2 ON
    LOWER(e1.last_name) = LOWER(e2.last_name)
    AND e1.id < e2.id
    AND e1.company_name ILIKE '%Yeo%'
    AND e2.company_name ILIKE '%Yeo%'
  WHERE
    LOWER(e1.first_name) = LOWER(e2.first_name)
    OR LOWER(e1.first_name) LIKE LOWER(e2.first_name) || '%'
    OR LOWER(e2.first_name) LIKE LOWER(e1.first_name) || '%'
    OR (LOWER(e1.first_name) IN ('chris', 'christopher') AND LOWER(e2.first_name) IN ('chris', 'christopher'))
    OR (LOWER(e1.first_name) IN ('mike', 'michael') AND LOWER(e2.first_name) IN ('mike', 'michael'))
    OR (LOWER(e1.first_name) IN ('bill', 'william', 'will') AND LOWER(e2.first_name) IN ('bill', 'william', 'will'))
    OR (LOWER(e1.first_name) IN ('bob', 'robert', 'rob') AND LOWER(e2.first_name) IN ('bob', 'robert', 'rob'))
    OR (LOWER(e1.first_name) IN ('jim', 'james', 'jimmy') AND LOWER(e2.first_name) IN ('jim', 'james', 'jimmy'))
    OR (LOWER(e1.first_name) IN ('joe', 'joseph', 'joey') AND LOWER(e2.first_name) IN ('joe', 'joseph', 'joey'))
    OR (LOWER(e1.first_name) IN ('dan', 'daniel', 'danny') AND LOWER(e2.first_name) IN ('dan', 'daniel', 'danny'))
    OR (LOWER(e1.first_name) IN ('matt', 'matthew') AND LOWER(e2.first_name) IN ('matt', 'matthew'))
    OR (LOWER(e1.first_name) IN ('tom', 'thomas', 'tommy') AND LOWER(e2.first_name) IN ('tom', 'thomas', 'tommy'))
    OR (LOWER(e1.first_name) IN ('ed', 'edward', 'eddie') AND LOWER(e2.first_name) IN ('ed', 'edward', 'eddie'))
    OR (LOWER(e1.first_name) IN ('nick', 'nicholas') AND LOWER(e2.first_name) IN ('nick', 'nicholas'))
    OR (LOWER(e1.first_name) IN ('alex', 'alexander') AND LOWER(e2.first_name) IN ('alex', 'alexander'))
    OR (LOWER(e1.first_name) IN ('ben', 'benjamin') AND LOWER(e2.first_name) IN ('ben', 'benjamin'))
    OR (LOWER(e1.first_name) IN ('sam', 'samuel') AND LOWER(e2.first_name) IN ('sam', 'samuel'))
    OR (LOWER(e1.first_name) IN ('tim', 'timothy') AND LOWER(e2.first_name) IN ('tim', 'timothy'))
    OR (LOWER(e1.first_name) IN ('tony', 'anthony') AND LOWER(e2.first_name) IN ('tony', 'anthony'))
    OR (LOWER(e1.first_name) IN ('jen', 'jennifer', 'jenny') AND LOWER(e2.first_name) IN ('jen', 'jennifer', 'jenny'))
    OR (LOWER(e1.first_name) IN ('liz', 'elizabeth', 'beth') AND LOWER(e2.first_name) IN ('liz', 'elizabeth', 'beth'))
    OR (LOWER(e1.first_name) IN ('kate', 'katherine', 'kathy', 'katie') AND LOWER(e2.first_name) IN ('kate', 'katherine', 'kathy', 'katie'))
    OR (LOWER(e1.first_name) IN ('pat', 'patricia', 'patty') AND LOWER(e2.first_name) IN ('pat', 'patricia', 'patty'))
    OR (LOWER(e1.first_name) IN ('maggie', 'margaret', 'meg') AND LOWER(e2.first_name) IN ('maggie', 'margaret', 'meg'))
)
SELECT COUNT(*) as "Duplicates to Delete" FROM duplicates;


-- ============================================
-- STEP 3: DELETE DUPLICATES (Run after review!)
-- ============================================
-- ⚠️  WARNING: This permanently deletes records!
-- ⚠️  Make sure you've reviewed Step 1 output first!

-- Strategy: Keep the record with the LOWER id (typically created first)
-- Delete the record with the HIGHER id

DELETE FROM employee_manager
WHERE id IN (
  SELECT e2.id
  FROM employee_manager e1
  JOIN employee_manager e2 ON
    LOWER(e1.last_name) = LOWER(e2.last_name)
    AND e1.id < e2.id
    AND e1.company_name ILIKE '%Yeo%'
    AND e2.company_name ILIKE '%Yeo%'
  WHERE
    LOWER(e1.first_name) = LOWER(e2.first_name)
    OR LOWER(e1.first_name) LIKE LOWER(e2.first_name) || '%'
    OR LOWER(e2.first_name) LIKE LOWER(e1.first_name) || '%'
    OR (LOWER(e1.first_name) IN ('chris', 'christopher') AND LOWER(e2.first_name) IN ('chris', 'christopher'))
    OR (LOWER(e1.first_name) IN ('mike', 'michael') AND LOWER(e2.first_name) IN ('mike', 'michael'))
    OR (LOWER(e1.first_name) IN ('bill', 'william', 'will') AND LOWER(e2.first_name) IN ('bill', 'william', 'will'))
    OR (LOWER(e1.first_name) IN ('bob', 'robert', 'rob') AND LOWER(e2.first_name) IN ('bob', 'robert', 'rob'))
    OR (LOWER(e1.first_name) IN ('jim', 'james', 'jimmy') AND LOWER(e2.first_name) IN ('jim', 'james', 'jimmy'))
    OR (LOWER(e1.first_name) IN ('joe', 'joseph', 'joey') AND LOWER(e2.first_name) IN ('joe', 'joseph', 'joey'))
    OR (LOWER(e1.first_name) IN ('dan', 'daniel', 'danny') AND LOWER(e2.first_name) IN ('dan', 'daniel', 'danny'))
    OR (LOWER(e1.first_name) IN ('matt', 'matthew') AND LOWER(e2.first_name) IN ('matt', 'matthew'))
    OR (LOWER(e1.first_name) IN ('tom', 'thomas', 'tommy') AND LOWER(e2.first_name) IN ('tom', 'thomas', 'tommy'))
    OR (LOWER(e1.first_name) IN ('ed', 'edward', 'eddie') AND LOWER(e2.first_name) IN ('ed', 'edward', 'eddie'))
    OR (LOWER(e1.first_name) IN ('nick', 'nicholas') AND LOWER(e2.first_name) IN ('nick', 'nicholas'))
    OR (LOWER(e1.first_name) IN ('alex', 'alexander') AND LOWER(e2.first_name) IN ('alex', 'alexander'))
    OR (LOWER(e1.first_name) IN ('ben', 'benjamin') AND LOWER(e2.first_name) IN ('ben', 'benjamin'))
    OR (LOWER(e1.first_name) IN ('sam', 'samuel') AND LOWER(e2.first_name) IN ('sam', 'samuel'))
    OR (LOWER(e1.first_name) IN ('tim', 'timothy') AND LOWER(e2.first_name) IN ('tim', 'timothy'))
    OR (LOWER(e1.first_name) IN ('tony', 'anthony') AND LOWER(e2.first_name) IN ('tony', 'anthony'))
    OR (LOWER(e1.first_name) IN ('jen', 'jennifer', 'jenny') AND LOWER(e2.first_name) IN ('jen', 'jennifer', 'jenny'))
    OR (LOWER(e1.first_name) IN ('liz', 'elizabeth', 'beth') AND LOWER(e2.first_name) IN ('liz', 'elizabeth', 'beth'))
    OR (LOWER(e1.first_name) IN ('kate', 'katherine', 'kathy', 'katie') AND LOWER(e2.first_name) IN ('kate', 'katherine', 'kathy', 'katie'))
    OR (LOWER(e1.first_name) IN ('pat', 'patricia', 'patty') AND LOWER(e2.first_name) IN ('pat', 'patricia', 'patty'))
    OR (LOWER(e1.first_name) IN ('maggie', 'margaret', 'meg') AND LOWER(e2.first_name) IN ('maggie', 'margaret', 'meg'))
);


-- ============================================
-- STEP 4: VERIFY CLEANUP
-- ============================================
-- Run after delete to confirm duplicates are gone

SELECT COUNT(*) as "Total Yeo & Yeo Employees After Cleanup"
FROM employee_manager
WHERE company_name ILIKE '%Yeo%';
