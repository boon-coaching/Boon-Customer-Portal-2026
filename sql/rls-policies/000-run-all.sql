-- ============================================================================
-- 000-run-all.sql
-- Master RLS deployment script for Boon Customer Portal.
--
-- This script applies all RLS policies in the correct order:
--   1. Drop existing policies (safe for re-runs)
--   2. Enable RLS on all tables
--   3. Create tenant isolation policies
--   4. Create special-case policies
--   5. Create admin override policies
--
-- IMPORTANT: Review each section before executing against production.
-- This script does NOT execute any destructive operations beyond
-- dropping and recreating RLS policies.
--
-- Tables covered (14 tables + 1 view):
--   employee_manager, session_tracking, survey_submissions, program_config,
--   welcome_survey_baseline, welcome_survey_scale, competency_scores,
--   focus_area_selections, portal_events, onboarding_tasks, manager_surveys,
--   company_logos, company_account_team, boon_benchmarks
--   (competency_pre_post is a VIEW - protected via underlying tables)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop existing policies (safe re-run)
-- From: 005-drop-existing-policies.sql
-- ============================================================================

-- Drop tenant isolation policies
DROP POLICY IF EXISTS "tenant_isolation_select" ON employee_manager;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON employee_manager;
DROP POLICY IF EXISTS "tenant_isolation_update" ON employee_manager;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON employee_manager;

DROP POLICY IF EXISTS "tenant_isolation_select" ON session_tracking;

DROP POLICY IF EXISTS "tenant_isolation_select" ON survey_submissions;

DROP POLICY IF EXISTS "tenant_isolation_select" ON program_config;
DROP POLICY IF EXISTS "tenant_isolation_update" ON program_config;

DROP POLICY IF EXISTS "tenant_isolation_select" ON welcome_survey_baseline;

DROP POLICY IF EXISTS "tenant_isolation_select" ON welcome_survey_scale;

DROP POLICY IF EXISTS "tenant_isolation_select" ON competency_scores;

DROP POLICY IF EXISTS "tenant_isolation_select" ON focus_area_selections;

DROP POLICY IF EXISTS "tenant_isolation_select" ON onboarding_tasks;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON onboarding_tasks;
DROP POLICY IF EXISTS "tenant_isolation_update" ON onboarding_tasks;

DROP POLICY IF EXISTS "tenant_isolation_select" ON company_account_team;

-- Drop special-case policies
DROP POLICY IF EXISTS "tenant_isolation_insert" ON portal_events;
DROP POLICY IF EXISTS "admin_select_only" ON portal_events;

DROP POLICY IF EXISTS "tenant_isolation_select" ON manager_surveys;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON manager_surveys;

DROP POLICY IF EXISTS "authenticated_select" ON company_logos;
DROP POLICY IF EXISTS "admin_insert_only" ON company_logos;
DROP POLICY IF EXISTS "admin_update_only" ON company_logos;
DROP POLICY IF EXISTS "admin_delete_only" ON company_logos;

DROP POLICY IF EXISTS "authenticated_select" ON boon_benchmarks;
DROP POLICY IF EXISTS "admin_insert_only" ON boon_benchmarks;
DROP POLICY IF EXISTS "admin_update_only" ON boon_benchmarks;
DROP POLICY IF EXISTS "admin_delete_only" ON boon_benchmarks;

-- Drop admin override policies
DROP POLICY IF EXISTS "admin_full_access" ON employee_manager;
DROP POLICY IF EXISTS "admin_full_access" ON session_tracking;
DROP POLICY IF EXISTS "admin_full_access" ON survey_submissions;
DROP POLICY IF EXISTS "admin_full_access" ON program_config;
DROP POLICY IF EXISTS "admin_full_access" ON welcome_survey_baseline;
DROP POLICY IF EXISTS "admin_full_access" ON welcome_survey_scale;
DROP POLICY IF EXISTS "admin_full_access" ON competency_scores;
DROP POLICY IF EXISTS "admin_full_access" ON focus_area_selections;
DROP POLICY IF EXISTS "admin_full_access" ON portal_events;
DROP POLICY IF EXISTS "admin_full_access" ON onboarding_tasks;
DROP POLICY IF EXISTS "admin_full_access" ON manager_surveys;
DROP POLICY IF EXISTS "admin_full_access" ON company_logos;
DROP POLICY IF EXISTS "admin_full_access" ON company_account_team;
DROP POLICY IF EXISTS "admin_full_access" ON boon_benchmarks;

-- ============================================================================
-- Step 2: Enable RLS on all tables
-- From: 001-enable-rls-all-tables.sql
-- ============================================================================

ALTER TABLE employee_manager ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_manager FORCE ROW LEVEL SECURITY;

ALTER TABLE session_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tracking FORCE ROW LEVEL SECURITY;

ALTER TABLE survey_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions FORCE ROW LEVEL SECURITY;

ALTER TABLE program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_config FORCE ROW LEVEL SECURITY;

ALTER TABLE welcome_survey_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_survey_baseline FORCE ROW LEVEL SECURITY;

ALTER TABLE welcome_survey_scale ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_survey_scale FORCE ROW LEVEL SECURITY;

ALTER TABLE competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_scores FORCE ROW LEVEL SECURITY;

ALTER TABLE focus_area_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_area_selections FORCE ROW LEVEL SECURITY;

ALTER TABLE portal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_events FORCE ROW LEVEL SECURITY;

ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE manager_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_surveys FORCE ROW LEVEL SECURITY;

ALTER TABLE company_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_logos FORCE ROW LEVEL SECURITY;

ALTER TABLE company_account_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_account_team FORCE ROW LEVEL SECURITY;

ALTER TABLE boon_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE boon_benchmarks FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 3: Tenant isolation policies
-- From: 002-tenant-isolation-policies.sql
-- ============================================================================

-- employee_manager: SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "tenant_isolation_select" ON employee_manager
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_insert" ON employee_manager
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_update" ON employee_manager
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_delete" ON employee_manager
  FOR DELETE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- session_tracking: SELECT only
CREATE POLICY "tenant_isolation_select" ON session_tracking
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- survey_submissions: SELECT only
CREATE POLICY "tenant_isolation_select" ON survey_submissions
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- program_config: SELECT and UPDATE
CREATE POLICY "tenant_isolation_select" ON program_config
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_update" ON program_config
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- welcome_survey_baseline: SELECT only
CREATE POLICY "tenant_isolation_select" ON welcome_survey_baseline
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- welcome_survey_scale: SELECT only
CREATE POLICY "tenant_isolation_select" ON welcome_survey_scale
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- competency_scores: SELECT only
CREATE POLICY "tenant_isolation_select" ON competency_scores
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- focus_area_selections: SELECT only
CREATE POLICY "tenant_isolation_select" ON focus_area_selections
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- onboarding_tasks: SELECT, INSERT, UPDATE
CREATE POLICY "tenant_isolation_select" ON onboarding_tasks
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_insert" ON onboarding_tasks
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_update" ON onboarding_tasks
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- company_account_team: SELECT only
CREATE POLICY "tenant_isolation_select" ON company_account_team
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- Step 4: Special case policies
-- From: 003-special-case-policies.sql
-- ============================================================================

-- portal_events: Uses client_id, not company_id
CREATE POLICY "tenant_isolation_insert" ON portal_events
  FOR INSERT WITH CHECK (
    client_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    AND user_id = auth.uid()
  );

CREATE POLICY "admin_select_only" ON portal_events
  FOR SELECT USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- manager_surveys: Add company_id column if missing, then apply policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_surveys' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE manager_surveys ADD COLUMN company_id uuid;
    CREATE INDEX IF NOT EXISTS idx_manager_surveys_company_id
      ON manager_surveys (company_id);
    RAISE NOTICE 'Added company_id column to manager_surveys';
  ELSE
    RAISE NOTICE 'company_id column already exists on manager_surveys';
  END IF;
END $$;

CREATE POLICY "tenant_isolation_select" ON manager_surveys
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_insert" ON manager_surveys
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- company_logos: Authenticated read, admin-only write
CREATE POLICY "authenticated_select" ON company_logos
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

CREATE POLICY "admin_insert_only" ON company_logos
  FOR INSERT WITH CHECK (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

CREATE POLICY "admin_update_only" ON company_logos
  FOR UPDATE USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

CREATE POLICY "admin_delete_only" ON company_logos
  FOR DELETE USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- boon_benchmarks: Authenticated read, admin-only write
CREATE POLICY "authenticated_select" ON boon_benchmarks
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

CREATE POLICY "admin_insert_only" ON boon_benchmarks
  FOR INSERT WITH CHECK (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

CREATE POLICY "admin_update_only" ON boon_benchmarks
  FOR UPDATE USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

CREATE POLICY "admin_delete_only" ON boon_benchmarks
  FOR DELETE USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- ============================================================================
-- Step 5: Admin override policies
-- From: 004-admin-override-policies.sql
-- ============================================================================

CREATE POLICY "admin_full_access" ON employee_manager
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON session_tracking
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON survey_submissions
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON program_config
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON welcome_survey_baseline
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON welcome_survey_scale
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON competency_scores
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON focus_area_selections
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON portal_events
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON onboarding_tasks
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON manager_surveys
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON company_logos
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON company_account_team
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY "admin_full_access" ON boon_benchmarks
  FOR ALL USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT CHECKLIST:
-- ============================================================================
-- 1. Backfill manager_surveys.company_id from employee_manager:
--      UPDATE manager_surveys ms
--      SET company_id = em.company_id
--      FROM employee_manager em
--      WHERE ms.employee_id = em.id
--        AND ms.company_id IS NULL;
--
-- 2. Once backfilled, make company_id NOT NULL:
--      ALTER TABLE manager_surveys ALTER COLUMN company_id SET NOT NULL;
--
-- 3. Set security_barrier on the competency_pre_post view:
--      ALTER VIEW competency_pre_post SET (security_barrier = true);
--
-- 4. Verify admin users have role='admin' in app_metadata:
--      SELECT id, email, raw_app_meta_data->>'role' as role
--      FROM auth.users
--      WHERE raw_app_meta_data->>'role' = 'admin';
--
-- 5. Test with a non-admin user to confirm tenant isolation works.
-- 6. Test with an admin user to confirm cross-company access works.
-- ============================================================================
