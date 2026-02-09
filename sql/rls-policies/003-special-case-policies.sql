-- ============================================================================
-- 003-special-case-policies.sql
-- Handle tables that don't follow the standard company_id pattern.
--
-- Special cases:
--   1. portal_events: Uses client_id (not company_id) for tenant scope
--   2. manager_surveys: Missing company_id column - needs schema migration
--   3. company_logos: Uses company_name - shared read, admin-only write
--   4. boon_benchmarks: Global shared data - read all, admin-only write
-- ============================================================================

-- ============================================================================
-- 1. portal_events
-- Analytics tracking table. Uses client_id to identify the company.
-- INSERT: Users can only insert events for their own company + their own user_id.
-- SELECT: Restricted to admin only (analytics are internal).
-- ============================================================================

-- Users can insert events only for their own company and user identity
CREATE POLICY "tenant_isolation_insert" ON portal_events
  FOR INSERT WITH CHECK (
    client_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
    AND user_id = auth.uid()
  );

-- Only admins can read analytics events
CREATE POLICY "admin_select_only" ON portal_events
  FOR SELECT USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );

-- ============================================================================
-- 2. manager_surveys
-- Manager-submitted surveys. Currently has NO company_id column.
-- Step A: Add a company_id column (nullable initially so existing rows aren't broken).
-- Step B: Apply tenant isolation policies using the new column.
--
-- After running this migration, you should backfill company_id for existing rows
-- by joining manager_surveys.employee_id to employee_manager.id to get the
-- company_id, then make the column NOT NULL.
-- ============================================================================

-- Step A: Add company_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_surveys' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE manager_surveys ADD COLUMN company_id uuid;

    -- Add index for performance on the new column
    CREATE INDEX IF NOT EXISTS idx_manager_surveys_company_id
      ON manager_surveys (company_id);

    RAISE NOTICE 'Added company_id column to manager_surveys';
  ELSE
    RAISE NOTICE 'company_id column already exists on manager_surveys';
  END IF;
END $$;

-- Step B: Tenant isolation for manager_surveys
-- SELECT: Users can only see surveys for their company
CREATE POLICY "tenant_isolation_select" ON manager_surveys
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- INSERT: Users can only submit surveys tagged with their company_id
CREATE POLICY "tenant_isolation_insert" ON manager_surveys
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- ============================================================================
-- 3. company_logos
-- Logo lookup table keyed by company_name (text), not company_id (uuid).
-- SELECT: All authenticated users can read logos (needed for branding on login).
-- INSERT/UPDATE/DELETE: Restricted to admin only.
-- ============================================================================

-- Any authenticated user can read logos (used for portal branding)
CREATE POLICY "authenticated_select" ON company_logos
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Only admins can create, update, or delete logos
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

-- ============================================================================
-- 4. boon_benchmarks
-- Global benchmark data shared across all companies (no company_id).
-- SELECT: All authenticated users can read benchmarks for comparisons.
-- INSERT/UPDATE/DELETE: Restricted to admin only.
-- ============================================================================

-- Any authenticated user can read benchmark data
CREATE POLICY "authenticated_select" ON boon_benchmarks
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Only admins can manage benchmark data
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
