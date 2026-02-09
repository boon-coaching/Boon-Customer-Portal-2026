-- set-admin-role.sql
-- Server-side function to set admin role in user's app_metadata.
-- This makes admin status tamper-proof (JWT is signed server-side).
--
-- IMPORTANT: Run this in Supabase SQL Editor as a superuser/service_role.
-- Do NOT expose this function to anon or authenticated roles.

-- 1. Create the function (SECURITY DEFINER runs as the function owner, not the caller)
CREATE OR REPLACE FUNCTION set_admin_role(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
  WHERE id = target_user_id;
END;
$$;

-- 2. Revoke access from public roles (only service_role / superuser can call this)
REVOKE ALL ON FUNCTION set_admin_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_admin_role(UUID) FROM anon;
REVOKE ALL ON FUNCTION set_admin_role(UUID) FROM authenticated;

-- 3. Helper: Remove admin role from a user
CREATE OR REPLACE FUNCTION remove_admin_role(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data - 'role'
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION remove_admin_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_admin_role(UUID) FROM anon;
REVOKE ALL ON FUNCTION remove_admin_role(UUID) FROM authenticated;
