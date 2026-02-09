# RLS (Row Level Security) Policy Audit Report

**Project:** Boon Customer Portal
**Audit Date:** 2026-02-08
**Auditor:** Agent 1 - RLS Policy Auditor
**Scope:** All Supabase tables, SQL scripts, edge functions, and client-side data access patterns

---

## Executive Summary

This audit reveals **critical security gaps** in the Boon Customer Portal's multi-tenant data isolation. The application relies almost entirely on **client-side filtering** (application-layer company_id/account_name filters) rather than database-enforced Row Level Security (RLS) policies. There is **no evidence in the codebase of any RLS policies being created, enabled, or enforced** on any table. This means that any authenticated user with the Supabase anon key could potentially read, modify, or delete data belonging to any company in the system.

**Critical Finding Count:** 5
**High Finding Count:** 4
**Medium Finding Count:** 4
**Low Finding Count:** 2

---

## Table Inventory

The following tables are accessed by the application. For each, I document whether RLS enforcement was found in the codebase.

| Table | RLS Enabled (in code) | RLS Policies Found | company_id Column | Operations |
|---|---|---|---|---|
| employee_manager | **NO EVIDENCE** | None | Yes | SELECT, INSERT, UPDATE, DELETE |
| session_tracking | **NO EVIDENCE** | None | Yes | SELECT |
| survey_submissions | **NO EVIDENCE** | None | Yes | SELECT |
| program_config | **NO EVIDENCE** | None | Yes | SELECT, UPDATE |
| welcome_survey_baseline | **NO EVIDENCE** | None | Yes | SELECT |
| welcome_survey_scale | **NO EVIDENCE** | None | Yes | SELECT |
| competency_scores | **NO EVIDENCE** | None | Yes | SELECT |
| competency_pre_post (view) | **NO EVIDENCE** | N/A (view) | Yes | SELECT |
| focus_area_selections | **NO EVIDENCE** | None | Yes | SELECT |
| boon_benchmarks | **NO EVIDENCE** | None | N/A (global) | SELECT |
| portal_events | **NO EVIDENCE** | None | client_id | INSERT |
| company_logos | **NO EVIDENCE** | None | company_name | SELECT |
| onboarding_tasks | **NO EVIDENCE** | None | company_id | SELECT, UPSERT |
| company_account_team | **NO EVIDENCE** | None | Unknown | SELECT |
| manager_surveys | **NO EVIDENCE** | None | None (employee_id FK) | SELECT, INSERT |
| coaches | **NOT QUERIED** | None found | Unknown | N/A |
| coaching_wins | **NOT QUERIED** | None found | Unknown | N/A |
| action_items | **NOT QUERIED** | None found | Unknown | N/A |

---

## Detailed Findings

### [CRITICAL] C1: No RLS Policies Found Anywhere in Codebase

- **Table(s):** ALL tables (employee_manager, session_tracking, survey_submissions, program_config, welcome_survey_baseline, welcome_survey_scale, competency_scores, focus_area_selections, portal_events, onboarding_tasks, manager_surveys, company_logos, company_account_team, boon_benchmarks)
- **Risk:** Complete cross-tenant data exposure. Without RLS, any authenticated user can read, insert, update, or delete data for ANY company by crafting direct Supabase API calls or by modifying the client-side JavaScript. The Supabase anon key is hardcoded in `lib/supabaseClient.ts:6` and visible in the client bundle, meaning anyone with the key can bypass the UI entirely and query any table without company_id restrictions.
- **Evidence:**
  - Searched all 8 SQL files in `/scripts/` -- zero contain `CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, or `FORCE ROW LEVEL SECURITY` statements.
  - Searched entire codebase for `RLS`, `row level security`, `CREATE POLICY`, `ENABLE ROW`, `FORCE ROW` -- only found comments about **avoiding** RLS issues:
    - `App.tsx:437`: `// Get program type from JWT app_metadata (no DB query needed - avoids RLS issues)`
    - `App.tsx:495`: `// Note: program_config fallback removed due to RLS/API key issues`
  - These comments suggest RLS was attempted at some point but was removed or worked around rather than properly implemented.
- **Recommendation:** Enable RLS on every table in Supabase and create PERMISSIVE SELECT/INSERT/UPDATE/DELETE policies that enforce `company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid` for each operation. This is the single most important security fix.

---

### [CRITICAL] C2: Application-Layer-Only Tenant Isolation

- **Table(s):** employee_manager, session_tracking, survey_submissions, program_config, welcome_survey_baseline, welcome_survey_scale, competency_scores, focus_area_selections
- **Risk:** All multi-tenant data isolation is enforced only at the application layer via optional `CompanyFilter` parameters in `lib/dataFetcher.ts`. These filters are applied as `.eq('company_id', filter.companyId)` or `.ilike('account_name', ...)` on Supabase queries -- but since no RLS exists, an attacker who calls the Supabase REST API directly (using the publicly exposed anon key) can query any table without these filters.
- **Evidence:**
  - `lib/dataFetcher.ts:92-104` - `getEmployeeRoster()` applies company filter only if `filter?.accountName` or `filter?.companyId` is provided. If neither is provided, the query returns ALL employees across ALL companies.
  - `lib/dataFetcher.ts:152-165` - `getDashboardSessions()` same pattern -- no filter = all data.
  - `lib/dataFetcher.ts:207-243` - `getSurveySubmissions()` same pattern.
  - `lib/dataFetcher.ts:810-811` - `buildCompanyFilter()` returns empty `{}` if no filter available, with comment: `// No filter - will return all data (should not happen in practice)`.
  - Every data fetcher function follows this pattern -- filtering is purely additive and never mandatory.
- **Recommendation:** RLS is the proper fix. As a defense-in-depth measure, also modify `buildCompanyFilter()` to throw an error or return a safe default when no company context is available, rather than returning an empty filter.

---

### [CRITICAL] C3: Hardcoded Supabase Anon Key in Client Bundle

- **Table(s):** All tables accessible via anon key
- **Risk:** The Supabase anon key is hardcoded as a fallback in `lib/supabaseClient.ts:6`:
  ```
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  ```
  This key is shipped in the client JavaScript bundle and is publicly accessible. Without RLS, this key grants unrestricted read/write access to all public schema tables. Even *with* RLS, hardcoding credentials as fallbacks is poor practice.
- **Evidence:** `lib/supabaseClient.ts:5-6` -- full anon key visible. The key decodes to: `{"iss":"supabase","ref":"nbwwqreqmxakevkwzmij","role":"anon","iat":1765416695,"exp":2080992695}`.
- **Recommendation:**
  1. Remove the hardcoded fallback -- require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables.
  2. Enable RLS on all tables so the anon key is safe to be public (as intended by Supabase's design).
  3. Consider rotating the anon key after RLS is enabled since the current key has been exposed.

---

### [CRITICAL] C4: Write Operations Have No Server-Side Authorization

- **Table(s):** employee_manager, portal_events, onboarding_tasks, program_config, manager_surveys
- **Risk:** The application performs INSERT, UPDATE, DELETE, and UPSERT operations on multiple tables with no RLS policies to restrict which company's data can be modified. Any authenticated user can:
  - Insert employees into any company (`components/EmployeeDashboard.tsx:932-941`)
  - Delete any employee (`components/EmployeeDashboard.tsx:914-918`)
  - Update any employee record (`components/EmployeeDashboard.tsx:947-952`)
  - Batch upload employees to any company (`components/EmployeeDashboard.tsx:1383-1386`)
  - Modify any company's program_config (`components/SetupDashboard.tsx:352-355`)
  - Insert portal events with arbitrary client_id (`lib/useAnalytics.ts:72-79`)
  - Insert manager survey responses for any employee (`components/ManagerDashboard.tsx:581-589`)
  - Upsert onboarding tasks for any company (`components/SetupDashboard.tsx:367-373`)
- **Evidence:**
  - `components/EmployeeDashboard.tsx:914-918` -- DELETE from employee_manager uses only `.eq('id', employee!.id)` -- no company_id check.
  - `components/EmployeeDashboard.tsx:932-941` -- INSERT into employee_manager includes `company_id: companyId || null` but this is passed from the client and not validated server-side.
  - `components/SetupDashboard.tsx:352-355` -- UPDATE program_config with `.eq('company_id', companyId)` where `companyId` is from the client's JWT but not enforced by RLS.
- **Recommendation:** Enable RLS on all tables with write policies. For INSERT: require that the `company_id` in the new row matches `auth.jwt()->'app_metadata'->>'company_id'`. For UPDATE/DELETE: require that the existing row's `company_id` matches. For admin operations, create a separate admin role or use SECURITY DEFINER functions.

---

### [CRITICAL] C5: SECURITY DEFINER Function Bypasses All Access Control

- **Table(s):** employee_manager, session_tracking, welcome_survey_scale, welcome_survey_baseline
- **Risk:** The `merge_duplicate_employees` function is defined with `SECURITY DEFINER` (line 72 of `scripts/fix-employee-duplicate-merge.sql`), which means it runs with the privileges of the function owner (typically the database superuser), completely bypassing RLS. The function accepts arbitrary `keep_employee_id` and `delete_employee_id` parameters and performs cross-table UPDATE and DELETE operations with no authorization checks. Any authenticated user who can call this RPC function can delete any employee and reassign their data.
- **Evidence:**
  - `scripts/fix-employee-duplicate-merge.sql:66-116` -- Function definition with `SECURITY DEFINER` and no authorization checks.
  - `components/EmployeeDashboard.tsx:383-387` -- Client code calls `supabase.rpc('merge_duplicate_employees', {...})` with comment `// Use RPC function to merge employees (bypasses RLS)`.
  - The function has no check for: user role, company_id match, or whether the caller has permission to modify those specific employees.
- **Recommendation:**
  1. Add authorization checks inside the function: verify the caller's company_id matches the employees being merged.
  2. Restrict the function to admin users only by checking `auth.jwt()->'app_metadata'->>'role' = 'admin'` or similar.
  3. Consider using `SECURITY INVOKER` instead and relying on RLS policies.

---

### [HIGH] H1: SQL Admin Scripts Lack company_id Scoping

- **Table(s):** employee_manager, session_tracking, welcome_survey_scale, survey_submissions
- **Risk:** Multiple SQL scripts perform bulk UPDATE and DELETE operations scoped only by email addresses or company names, not by company_id. While these scripts are run manually in the SQL Editor (presumably with admin credentials), they demonstrate patterns where data modifications are not constrained by the multi-tenant boundary.
- **Evidence:**
  - `scripts/fix-72andsunny-all-tables.sql` -- Updates session_tracking, welcome_survey_scale, and survey_submissions using email-based WHERE clauses with no company_id constraint. A typo in an email could modify another company's data.
  - `scripts/fix-72andsunny-data.sql` -- Updates session_tracking and employee_manager using `ILIKE '%72andSunny%'` pattern matching which could match unintended records.
  - `scripts/cleanup-duplicates-yeo.sql:129-163` -- Deletes employees using a name-similarity JOIN that could match employees from other companies if company_name filtering were imprecise.
  - `scripts/fix-employee-duplicate-merge.sql:37-53` -- Commented-out UPDATE/DELETE statements operate on specific IDs with no company_id guard.
- **Recommendation:** All admin SQL scripts should include `AND company_id = 'expected-uuid'` in their WHERE clauses as a safety net, even when filtering by email.

---

### [HIGH] H2: No RLS on portal_events Allows Activity Tracking Forgery

- **Table(s):** portal_events
- **Risk:** The `portal_events` table accepts INSERT operations from the client (`lib/useAnalytics.ts:72-79`) with `user_id` and `client_id` values set by client-side JavaScript. Without RLS, a malicious user could:
  1. Insert fake activity events for other users/companies
  2. Read the portal_events table to see all portal activity across all companies (revealing which companies use the product, user engagement patterns, etc.)
- **Evidence:**
  - `lib/useAnalytics.ts:72-79` -- Inserts events with `user_id: userId, client_id: clientId` where both values come from the client session.
  - `scripts/create-portal-events-view.sql:7-22` -- Creates views that aggregate portal_events across all clients, confirming the table contains cross-tenant data.
  - The views reference a `clients` table and `auth.users`, suggesting portal_events contains sensitive usage data.
- **Recommendation:** Enable RLS on portal_events. INSERT policy: `user_id = auth.uid()` and `client_id = auth.jwt()->'app_metadata'->>'company_id'`. SELECT policy: restrict to admin role or own company's events.

---

### [HIGH] H3: Admin Role Check is Client-Side Only

- **Table(s):** All tables (admin can switch to any company)
- **Risk:** Admin access is determined solely by checking if the user's email ends with `@boon-health.com` (`constants.ts:5-8`). This check happens only in the browser. There is no corresponding server-side enforcement (no admin role in RLS policies, no Supabase custom claims check). This means:
  1. If an attacker compromises any `@boon-health.com` email account, they get admin access.
  2. Since there's no RLS, non-admin users can already access all data anyway -- making the admin check purely cosmetic.
- **Evidence:**
  - `constants.ts:5-8` -- `isAdminEmail` checks `email.toLowerCase().endsWith('@boon-health.com')`.
  - Used in 12+ components (App.tsx, EmployeeDashboard.tsx, ThemesDashboard.tsx, etc.) to gate UI features.
  - No corresponding server-side check in any RLS policy or edge function.
  - Admin users can switch companies via localStorage (`App.tsx:330-337`), which overwrites the company filter client-side.
- **Recommendation:**
  1. Add a proper `role` claim in `app_metadata` (e.g., `role: 'admin'`) and use it in RLS policies.
  2. For admin override functionality, create a SECURITY DEFINER function that validates the caller's admin role before returning cross-tenant data.

---

### [HIGH] H4: Manager Dashboard Queries Lack Company Scoping

- **Table(s):** employee_manager, session_tracking, manager_surveys
- **Risk:** The ManagerDashboard queries employees by `manager_email` without company_id scoping. If the same email address were used across companies (unlikely but not prevented), a manager could see employees from another company.
- **Evidence:**
  - `components/ManagerDashboard.tsx:72` -- `.from('employee_manager').select('*').eq('manager_email', email)` -- no company_id filter.
  - `components/ManagerDashboard.tsx:83` -- Fetches direct reports by manager_email, no company_id.
  - `components/ManagerDashboard.tsx:100` -- Fetches sessions for specific employee_ids (obtained from the unscoped manager query).
  - `components/ManagerDashboard.tsx:111` -- Fetches manager_surveys by employee_id with no company_id.
  - `components/ManagerDashboard.tsx:582` -- Inserts manager_survey with no company_id at all.
- **Recommendation:** Add company_id filtering to all ManagerDashboard queries. The `manager_surveys` table should include a company_id column. With RLS enabled, these queries would be automatically scoped.

---

### [MEDIUM] M1: Fallback Queries Use Loose String Matching (ilike)

- **Table(s):** survey_submissions, competency_pre_post, focus_area_selections, competency_scores, welcome_survey_baseline, welcome_survey_scale
- **Risk:** Multiple data fetcher functions use `ilike('account_name', '%companyName%')` as a fallback when company_id returns no results. This partial string matching could return data from similarly-named companies (e.g., a company named "Acme" would match "Acme Corp", "Acme Labs", and "Acme International").
- **Evidence:**
  - `lib/dataFetcher.ts:218-231` -- `getSurveySubmissions()` fallback uses `.ilike('account_name', '%${fallbackName}%')`.
  - `lib/dataFetcher.ts:265-274` -- `getCompetencyPrePost()` same pattern.
  - `lib/dataFetcher.ts:304-315` -- `getFocusAreaSelections()` same pattern.
  - `lib/dataFetcher.ts:346-357` -- `getBaselineCompetencyScores()` same pattern.
  - `lib/dataFetcher.ts:391-402` -- `getCompetencyScores()` same pattern.
  - `lib/dataFetcher.ts:443-447` -- `getSurveyResponses()` same pattern.
  - `lib/dataFetcher.ts:537-547` -- `getWelcomeSurveyData()` same pattern.
  - `lib/dataFetcher.ts:615-626` -- `getWelcomeSurveyScaleData()` same pattern.
- **Recommendation:** With proper RLS, these fallback queries would be harmless since they'd be scoped to the user's company anyway. Until RLS is enabled, replace `ilike` fallbacks with exact matches and log cases where company_id is missing so data can be backfilled.

---

### [MEDIUM] M2: update-user-metadata.js Points to Wrong Supabase Instance

- **Table(s):** N/A (auth.users)
- **Risk:** The admin script `scripts/update-user-metadata.js` uses a hardcoded Supabase URL (`https://jbmhvqbwfhvldrfgjqjp.supabase.co`) that does NOT match the production instance (`https://nbwwqreqmxakevkwzmij.supabase.co`). This could indicate a staging/dev instance or a misconfiguration. The script also uses a service_role key (via environment variable) which has full database access.
- **Evidence:**
  - `scripts/update-user-metadata.js:2` -- `const supabaseUrl = 'https://jbmhvqbwfhvldrfgjqjp.supabase.co'` (differs from `lib/supabaseClient.ts:5`).
  - The script uses `supabase.auth.admin.updateUserById()` which requires service_role_key (bypasses all security).
  - No validation that the `company_id` being set in metadata actually exists or is correct.
- **Recommendation:**
  1. Parameterize the Supabase URL (use environment variables, not hardcoded values).
  2. Add validation that company_id exists in the companies/program_config table before setting it in user metadata.
  3. Add audit logging for all metadata changes.

---

### [MEDIUM] M3: Edge Function Does Not Validate User Authorization

- **Table(s):** N/A (but processes sensitive company data)
- **Risk:** The `ai-generate-insights` edge function (`supabase/functions/ai-generate-insights/index.ts`) accepts `companyName`, `companyId`, and `internalData` in the request body but does not validate:
  1. That the caller is authenticated (no JWT validation).
  2. That the caller has access to the specified company.
  3. That the `internalData` actually belongs to the specified company.
  The function has CORS set to `Access-Control-Allow-Origin: "*"`, allowing any origin to call it.
- **Evidence:**
  - `supabase/functions/ai-generate-insights/index.ts:6-8` -- CORS allows all origins.
  - `supabase/functions/ai-generate-insights/index.ts:17` -- Destructures request body without auth validation.
  - No `createClient()` call with user token, no `auth.getUser()` check.
  - The function sends `internalData` (potentially containing employee names, survey responses, coaching themes) to Anthropic's API.
- **Recommendation:**
  1. Validate the Authorization header and extract the user's JWT.
  2. Verify the user's company_id matches the requested companyId.
  3. Restrict CORS to the production domain(s).
  4. Do not trust `internalData` from the client -- fetch it server-side using the user's JWT to ensure RLS is applied.

---

### [MEDIUM] M4: Views Created Without Security Considerations

- **Table(s):** portal_activity_by_client, portal_activity_by_user, portal_event_summary
- **Risk:** The views created in `scripts/create-portal-events-view.sql` aggregate data across all clients and users with no `security_barrier` option. If these views are accessible to the `anon` role (which they likely are since no RLS restricts them), any authenticated user can see:
  - Which companies use the portal and their activity levels
  - Individual user emails and their activity patterns
  - Total event counts across all companies
- **Evidence:**
  - `scripts/create-portal-events-view.sql:7-22` -- `portal_activity_by_client` aggregates across all clients.
  - `scripts/create-portal-events-view.sql:27-41` -- `portal_activity_by_user` joins `auth.users` exposing emails.
  - `scripts/create-portal-events-view.sql:46-56` -- `portal_event_summary` shows global event stats.
  - No `WITH (security_barrier)` option on any view.
- **Recommendation:**
  1. Add `WITH (security_barrier)` to views.
  2. Restrict view access to admin/service_role only.
  3. Or delete these views and use admin-only dashboards for activity monitoring.

---

### [LOW] L1: Benchmarks Table Has No Company Scoping

- **Table(s):** boon_benchmarks
- **Risk:** The `boon_benchmarks` table appears to contain global benchmark data (not per-company) and is queried without any company filter. This is intentional (benchmarks are meant to be shared), but without RLS, anyone could potentially INSERT or UPDATE benchmark data, corrupting the benchmarks for all customers.
- **Evidence:**
  - `lib/dataFetcher.ts:717-739` -- `getBenchmarks()` queries with only `program_type` filter, no company_id.
  - `components/ScaleBaselineDashboard.tsx:129` -- Queries benchmarks similarly.
  - `components/HomeDashboard.tsx:153` -- Same pattern.
- **Recommendation:** Enable RLS on boon_benchmarks with a SELECT policy that allows all authenticated users to read, but restricts INSERT/UPDATE/DELETE to admin/service_role only.

---

### [LOW] L2: Cache Does Not Invalidate on Company Context Change

- **Table(s):** N/A (client-side concern)
- **Risk:** The in-memory cache in `lib/dataFetcher.ts:22-53` uses the `CompanyFilter` as part of the cache key. If an admin switches companies, the old company's data could be served from cache for up to 5 minutes. While this is a data leakage to an admin (who already has cross-company access), it could cause confusing data display.
- **Evidence:**
  - `lib/dataFetcher.ts:28` -- `CACHE_TTL = 5 * 60 * 1000` (5 minutes).
  - `lib/dataFetcher.ts:30-32` -- Cache key includes filter, but `App.tsx:292` calls `window.location.reload()` on company change, which would clear the in-memory cache.
- **Recommendation:** Low priority since page reload clears the cache. Consider calling `clearDataCache()` explicitly before switching company context.

---

## Summary of All Tables Needing RLS

The following RLS policies should be created for each table. All should use the pattern of checking `company_id` against the authenticated user's JWT metadata.

### Recommended RLS Policy Template

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

-- SELECT: Users can only see their own company's data
CREATE POLICY "company_isolation_select" ON table_name
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- INSERT: Users can only insert data for their own company
CREATE POLICY "company_isolation_insert" ON table_name
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- UPDATE: Users can only update their own company's data
CREATE POLICY "company_isolation_update" ON table_name
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- DELETE: Users can only delete their own company's data
CREATE POLICY "company_isolation_delete" ON table_name
  FOR DELETE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- Admin override: Boon staff can access all data
CREATE POLICY "admin_access" ON table_name
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );
```

### Tables Requiring This Template
1. **employee_manager** -- SELECT, INSERT, UPDATE, DELETE
2. **session_tracking** -- SELECT (and SELECT for admin)
3. **survey_submissions** -- SELECT
4. **program_config** -- SELECT, UPDATE
5. **welcome_survey_baseline** -- SELECT
6. **welcome_survey_scale** -- SELECT
7. **competency_scores** -- SELECT
8. **focus_area_selections** -- SELECT
9. **portal_events** -- INSERT (own company), SELECT (admin only)
10. **onboarding_tasks** -- SELECT, UPSERT (own company)
11. **manager_surveys** -- INSERT, SELECT (own company)
12. **company_logos** -- SELECT (all authenticated users)
13. **company_account_team** -- SELECT (own company or admin)
14. **boon_benchmarks** -- SELECT (all), write (admin only)

### Special Cases
- **competency_pre_post** -- This is a VIEW; apply RLS to underlying tables.
- **portal_events** -- Uses `client_id` not `company_id`; policy should match accordingly.
- **manager_surveys** -- Needs `company_id` column added; currently has no company scoping.

---

## Priority Remediation Roadmap

### Phase 1 (Immediate -- This Week)
1. Enable RLS on ALL tables with a simple `company_id` check policy
2. Add admin override policies for Boon staff
3. Test that existing application queries still work with RLS enabled
4. Rotate the Supabase anon key after confirming RLS works

### Phase 2 (Short-term -- Next 2 Weeks)
1. Add authorization checks to the `merge_duplicate_employees` SECURITY DEFINER function
2. Add JWT validation to the `ai-generate-insights` edge function
3. Restrict CORS on the edge function to production domains
4. Add `company_id` column to `manager_surveys` table
5. Remove hardcoded Supabase credentials from source code

### Phase 3 (Medium-term -- Next Month)
1. Replace `ilike` fallback queries with exact matches
2. Add `security_barrier` to database views or restrict access
3. Implement audit logging for admin operations
4. Add server-side validation for user metadata changes
5. Review and update all admin SQL scripts to include company_id guards

---

## Methodology

This audit was conducted by:
1. Reading all 8 SQL scripts in `/scripts/` directory
2. Reading `lib/dataFetcher.ts` (928 lines) -- all data access patterns
3. Reading `lib/supabaseClient.ts` -- client configuration
4. Reading `lib/useAnalytics.ts` -- event tracking
5. Reading `types.ts` -- data model definitions
6. Reading `supabase/functions/ai-generate-insights/index.ts` -- edge function
7. Reading `scripts/update-user-metadata.js` -- admin script
8. Reading `constants.ts` -- admin role definition
9. Searching for all `.from('table')` calls across the codebase
10. Searching for RLS-related keywords (CREATE POLICY, ENABLE ROW, SECURITY DEFINER, etc.)
11. Searching for all write operations (insert, update, delete, upsert, rpc)
12. Analyzing authentication flow in `App.tsx`
13. Analyzing write operations in `EmployeeDashboard.tsx`, `SetupDashboard.tsx`, `ManagerDashboard.tsx`
