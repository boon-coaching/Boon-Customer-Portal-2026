-- ============================================================================
-- 005-drop-existing-policies.sql
-- Safety script: Drop all RLS policies created by scripts 002-004.
--
-- Run this BEFORE re-applying policies to ensure a clean slate.
-- Uses DROP POLICY IF EXISTS so it is safe to run even if policies
-- don't exist yet (first-time setup).
-- ============================================================================

-- ============================================================================
-- Drop tenant isolation policies (from 002-tenant-isolation-policies.sql)
-- ============================================================================

-- employee_manager
DROP POLICY IF EXISTS "tenant_isolation_select" ON employee_manager;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON employee_manager;
DROP POLICY IF EXISTS "tenant_isolation_update" ON employee_manager;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON employee_manager;

-- session_tracking
DROP POLICY IF EXISTS "tenant_isolation_select" ON session_tracking;

-- survey_submissions
DROP POLICY IF EXISTS "tenant_isolation_select" ON survey_submissions;

-- program_config
DROP POLICY IF EXISTS "tenant_isolation_select" ON program_config;
DROP POLICY IF EXISTS "tenant_isolation_update" ON program_config;

-- welcome_survey_baseline
DROP POLICY IF EXISTS "tenant_isolation_select" ON welcome_survey_baseline;

-- welcome_survey_scale
DROP POLICY IF EXISTS "tenant_isolation_select" ON welcome_survey_scale;

-- competency_scores
DROP POLICY IF EXISTS "tenant_isolation_select" ON competency_scores;

-- focus_area_selections
DROP POLICY IF EXISTS "tenant_isolation_select" ON focus_area_selections;

-- onboarding_steps
DROP POLICY IF EXISTS "tenant_isolation_select" ON onboarding_steps;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON onboarding_steps;
DROP POLICY IF EXISTS "tenant_isolation_update" ON onboarding_steps;

-- company_account_team
DROP POLICY IF EXISTS "tenant_isolation_select" ON company_account_team;

-- ============================================================================
-- Drop special-case policies (from 003-special-case-policies.sql)
-- ============================================================================

-- portal_events
DROP POLICY IF EXISTS "tenant_isolation_insert" ON portal_events;
DROP POLICY IF EXISTS "admin_select_only" ON portal_events;

-- manager_surveys
DROP POLICY IF EXISTS "tenant_isolation_select" ON manager_surveys;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON manager_surveys;

-- company_logos
DROP POLICY IF EXISTS "authenticated_select" ON company_logos;
DROP POLICY IF EXISTS "admin_insert_only" ON company_logos;
DROP POLICY IF EXISTS "admin_update_only" ON company_logos;
DROP POLICY IF EXISTS "admin_delete_only" ON company_logos;

-- boon_benchmarks
DROP POLICY IF EXISTS "authenticated_select" ON boon_benchmarks;
DROP POLICY IF EXISTS "admin_insert_only" ON boon_benchmarks;
DROP POLICY IF EXISTS "admin_update_only" ON boon_benchmarks;
DROP POLICY IF EXISTS "admin_delete_only" ON boon_benchmarks;

-- ============================================================================
-- Drop admin override policies (from 004-admin-override-policies.sql)
-- ============================================================================

DROP POLICY IF EXISTS "admin_full_access" ON employee_manager;
DROP POLICY IF EXISTS "admin_full_access" ON session_tracking;
DROP POLICY IF EXISTS "admin_full_access" ON survey_submissions;
DROP POLICY IF EXISTS "admin_full_access" ON program_config;
DROP POLICY IF EXISTS "admin_full_access" ON welcome_survey_baseline;
DROP POLICY IF EXISTS "admin_full_access" ON welcome_survey_scale;
DROP POLICY IF EXISTS "admin_full_access" ON competency_scores;
DROP POLICY IF EXISTS "admin_full_access" ON focus_area_selections;
DROP POLICY IF EXISTS "admin_full_access" ON portal_events;
DROP POLICY IF EXISTS "admin_full_access" ON onboarding_steps;
DROP POLICY IF EXISTS "admin_full_access" ON manager_surveys;
DROP POLICY IF EXISTS "admin_full_access" ON company_logos;
DROP POLICY IF EXISTS "admin_full_access" ON company_account_team;
DROP POLICY IF EXISTS "admin_full_access" ON boon_benchmarks;
