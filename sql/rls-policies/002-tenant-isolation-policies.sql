-- ============================================================================
-- 002-tenant-isolation-policies.sql
-- Create company_id-based tenant isolation policies for standard tables.
--
-- These policies ensure each authenticated user can only access rows
-- belonging to their company, as identified by the company_id claim
-- in their JWT app_metadata.
--
-- JWT claim path: auth.jwt()->'app_metadata'->>'company_id'
-- ============================================================================

-- ============================================================================
-- employee_manager: SELECT, INSERT, UPDATE, DELETE
-- Used by: getEmployeeRoster() - full CRUD for employee roster management
-- ============================================================================

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

-- ============================================================================
-- session_tracking: SELECT only
-- Used by: getDashboardSessions() - read-only session data for dashboards
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON session_tracking
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- survey_submissions: SELECT only
-- Used by: getSurveySubmissions(), getSurveyResponses() - read-only survey data
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON survey_submissions
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- program_config: SELECT and UPDATE
-- Used by: getProgramConfig() for reading, SetupDashboard for updating config
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON program_config
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_update" ON program_config
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- welcome_survey_baseline: SELECT only
-- Used by: getWelcomeSurveyData() - legacy GROW baseline survey data
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON welcome_survey_baseline
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- welcome_survey_scale: SELECT only
-- Used by: getWelcomeSurveyScaleData() - legacy Scale baseline survey data
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON welcome_survey_scale
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- competency_scores: SELECT only
-- Used by: getBaselineCompetencyScores() - competency score records
-- Also protects the competency_pre_post view which reads from this table
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON competency_scores
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- focus_area_selections: SELECT only
-- Used by: getFocusAreaSelections() - employee focus area choices
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON focus_area_selections
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- onboarding_tasks: SELECT, INSERT, UPDATE (supports UPSERT via onConflict)
-- Used by: SetupDashboard - tracks company onboarding task completion
-- ============================================================================

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

-- ============================================================================
-- company_account_team: SELECT only
-- Used by: SetupDashboard - displays Boon account team assigned to company
-- ============================================================================

CREATE POLICY "tenant_isolation_select" ON company_account_team
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );
