-- ============================================================================
-- 004-admin-override-policies.sql
-- Admin override policies for ALL tables.
--
-- Boon staff with role='admin' in their JWT app_metadata get full
-- unrestricted access to all tables. This allows admins to view and manage
-- data across all companies (e.g., when switching company context).
--
-- These policies use FOR ALL to cover SELECT, INSERT, UPDATE, and DELETE
-- in a single policy per table.
-- ============================================================================

-- employee_manager: Admin full access
CREATE POLICY "admin_full_access" ON employee_manager
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- session_tracking: Admin full access
CREATE POLICY "admin_full_access" ON session_tracking
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- survey_submissions: Admin full access
CREATE POLICY "admin_full_access" ON survey_submissions
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- program_config: Admin full access
CREATE POLICY "admin_full_access" ON program_config
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- welcome_survey_baseline: Admin full access
CREATE POLICY "admin_full_access" ON welcome_survey_baseline
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- welcome_survey_scale: Admin full access
CREATE POLICY "admin_full_access" ON welcome_survey_scale
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- competency_scores: Admin full access
CREATE POLICY "admin_full_access" ON competency_scores
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- focus_area_selections: Admin full access
CREATE POLICY "admin_full_access" ON focus_area_selections
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- portal_events: Admin full access
CREATE POLICY "admin_full_access" ON portal_events
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- onboarding_steps: Admin full access
CREATE POLICY "admin_full_access" ON onboarding_steps
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- manager_surveys: Admin full access
CREATE POLICY "admin_full_access" ON manager_surveys
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- company_logos: Admin full access
-- Note: company_logos already has admin write policies in 003,
-- but this FOR ALL policy provides a unified admin override.
CREATE POLICY "admin_full_access" ON company_logos
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- company_account_team: Admin full access
CREATE POLICY "admin_full_access" ON company_account_team
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- boon_benchmarks: Admin full access
-- Note: boon_benchmarks already has admin write policies in 003,
-- but this FOR ALL policy provides a unified admin override.
CREATE POLICY "admin_full_access" ON boon_benchmarks
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );
