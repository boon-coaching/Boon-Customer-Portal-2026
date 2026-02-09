-- Add Media Arts Lab GROW programs to program_config
-- These programs exist in the 'programs' table but are missing from 'program_config'
-- which causes them not to appear in the Themes and Baseline dashboard dropdowns

-- Media Arts Lab company_id: 0f0e4325-db49-4daf-8f75-519f55cfba38

-- Step 1: Preview what will be inserted
SELECT 'PREVIEW - Programs to be added:' as action;
SELECT
    'Media Arts Lab' as account_name,
    name as program_title,
    program_type,
    id as program_id
FROM programs
WHERE company_id = '0f0e4325-db49-4daf-8f75-519f55cfba38'
  AND program_type = 'GROW';

-- Step 2: Check if any already exist in program_config
SELECT 'Checking for existing entries:' as action;
SELECT * FROM program_config
WHERE account_name ILIKE '%Media Arts Lab%'
  AND program_title ILIKE '%GROW%';

-- Step 3: Insert the missing GROW programs
-- Note: Adjust sessions_per_employee if needed (using 6 as default for GROW)
INSERT INTO program_config (account_name, program_title, program_type, sessions_per_employee, company_id)
VALUES
    ('Media Arts Lab', 'Media Arts Lab - APAC GROW', 'GROW', 6, '0f0e4325-db49-4daf-8f75-519f55cfba38'),
    ('Media Arts Lab', 'Media Arts Lab - LA GROW', 'GROW', 6, '0f0e4325-db49-4daf-8f75-519f55cfba38'),
    ('Media Arts Lab', 'Media Arts Lab - LATAM GROW', 'GROW', 6, '0f0e4325-db49-4daf-8f75-519f55cfba38')
ON CONFLICT DO NOTHING;

-- Step 4: Verify the insert worked
SELECT 'Verification - All Media Arts Lab programs in program_config:' as action;
SELECT
    id,
    account_name,
    program_title,
    program_type,
    sessions_per_employee,
    program_start_date
FROM program_config
WHERE account_name ILIKE '%Media Arts Lab%'
ORDER BY program_type, program_title;
