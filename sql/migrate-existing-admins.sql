-- migrate-existing-admins.sql
-- One-time migration: set role='admin' in app_metadata for all existing
-- @boon-health.com users so the client-side fallback is no longer needed.
--
-- IMPORTANT: Run this in Supabase SQL Editor as superuser/service_role.
-- Review the SELECT query first to confirm the list of users.

-- Step 1: Preview which users will be updated (run this first)
SELECT id, email, raw_app_meta_data->>'role' AS current_role
FROM auth.users
WHERE email ILIKE '%@boon-health.com'
ORDER BY email;

-- Step 2: Set admin role for all @boon-health.com users
-- Uncomment the UPDATE below after verifying Step 1 output.

-- UPDATE auth.users
-- SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
-- WHERE email ILIKE '%@boon-health.com'
--   AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != 'admin');

-- Step 3: Verify the migration worked
-- SELECT id, email, raw_app_meta_data->>'role' AS new_role
-- FROM auth.users
-- WHERE email ILIKE '%@boon-health.com'
-- ORDER BY email;
