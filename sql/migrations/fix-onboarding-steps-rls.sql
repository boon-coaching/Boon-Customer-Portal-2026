-- ============================================================================
-- fix-onboarding-steps-rls.sql
-- URGENT: Enable RLS on onboarding_steps table.
--
-- Background: The table was renamed from onboarding_tasks to onboarding_steps,
-- but RLS policies were never applied to the renamed table. Currently the table
-- has NO RLS, meaning any user (including unauthenticated anon key holders)
-- can read and write all rows.
--
-- Run this in Supabase SQL Editor immediately.
-- ============================================================================

BEGIN;

-- Step 1: Enable RLS
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps FORCE ROW LEVEL SECURITY;

-- Step 2: Tenant isolation policies
CREATE POLICY "tenant_isolation_select" ON onboarding_steps
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_insert" ON onboarding_steps
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_update" ON onboarding_steps
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- Step 3: Admin override
CREATE POLICY "admin_full_access" ON onboarding_steps
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

COMMIT;

-- ============================================================================
-- VERIFICATION: Run after applying to confirm policies are in place.
-- Expected: 4 rows (tenant_isolation_select, _insert, _update, admin_full_access)
-- ============================================================================
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'onboarding_steps';
