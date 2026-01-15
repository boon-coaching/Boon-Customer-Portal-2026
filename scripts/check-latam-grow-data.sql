-- Check LATAM GROW employees in employee_manager
SELECT full_name, email, program_title, coaching_program, status
FROM employee_manager 
WHERE (program_title ILIKE '%berggruen%' OR coaching_program ILIKE '%berggruen%')
  AND (program_title ILIKE '%LATAM%' OR coaching_program ILIKE '%LATAM%' OR program_title ILIKE '%grow%' OR coaching_program ILIKE '%grow%')
ORDER BY program_title;

-- Check all Berggruen welcome surveys
SELECT id, first_name, last_name, email, program_title, account, created_at
FROM welcome_survey_baseline
WHERE account ILIKE '%berggruen%'
ORDER BY program_title, created_at;

-- Check sessions for LATAM GROW
SELECT DISTINCT s.employee_name, s.employee_id, s.program_title, COUNT(*) as session_count
FROM session_tracking s
WHERE s.program_title ILIKE '%LATAM%GROW%' OR s.program_title ILIKE '%berggruen%LATAM%'
GROUP BY s.employee_name, s.employee_id, s.program_title;
