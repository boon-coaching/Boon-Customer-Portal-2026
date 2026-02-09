# CHANGELOG

## [Security Remediation - Phase 1] - 2026-02-08

Critical security fixes addressing findings C-1 through C-7 from the security audit.
All database changes are saved as SQL scripts in `/sql/` — none have been executed against Supabase.

---

### 1. Row Level Security (RLS) Policies

**New files in `sql/rls-policies/`:**

| File | Purpose |
|------|---------|
| `000-run-all.sql` | Master deployment script (atomic transaction) |
| `001-enable-rls-all-tables.sql` | Enables RLS + FORCE RLS on 14 tables |
| `002-tenant-isolation-policies.sql` | company_id-based tenant isolation (SELECT/INSERT/UPDATE/DELETE) for 10 standard tables |
| `003-special-case-policies.sql` | Special handling for portal_events (client_id), manager_surveys (adds company_id column), company_logos, boon_benchmarks |
| `004-admin-override-policies.sql` | Admin `FOR ALL` override on all 14 tables |
| `005-drop-existing-policies.sql` | Safe `DROP POLICY IF EXISTS` for idempotent re-runs |

**Tables covered:** employee_manager, session_tracking, survey_submissions, program_config, welcome_survey_baseline, welcome_survey_scale, competency_scores, focus_area_selections, portal_events, onboarding_tasks, manager_surveys, company_logos, company_account_team, boon_benchmarks

**Addresses:** Audit finding C-1 (No RLS on any table)

---

### 2. Admin Role Migration (Email Domain Check → JWT app_metadata)

**SQL scripts (not executed):**
- `sql/set-admin-role.sql` — `set_admin_role()` and `remove_admin_role()` SECURITY DEFINER functions
- `sql/migrate-existing-admins.sql` — One-time migration to set `role='admin'` for existing @boon-health.com users

**Code changes:**

| File | Change |
|------|--------|
| `constants.ts` | Added `isAdminUser(session)` that checks `app_metadata.role === 'admin'` first, falls back to email domain during migration. Deprecated `isAdminEmail()`. |
| `App.tsx` | Changed `isAdminEmail(email)` → `isAdminUser(session)` |
| `components/HomeDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/SessionDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/EmployeeDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/SetupDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/ScaleDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/ImpactDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/BaselineDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/ScaleBaselineDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/ThemesDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/FeedbackDashboard.tsx` | Migrated to `isAdminUser(session)` |
| `components/ReportGenerator.tsx` | Migrated to `isAdminUser(session)` (3 usages) |

**Addresses:** Audit findings C-3 (client-side admin check), C-4 (admin switcher no server validation)

---

### 3. Edge Function Security (JWT Validation + CORS)

| File | Change |
|------|--------|
| `supabase/functions/ai-generate-insights/index.ts` | Added JWT validation via `supabase.auth.getUser(token)`. Added company ownership check (returns 403 if companyId mismatch and user is not admin). Changed CORS from `"*"` to `Deno.env.get('ALLOWED_ORIGIN')` with fallback to `https://portal.boon-health.com`. |

**Addresses:** Audit findings C-7 (unauthenticated AI endpoint), H-9 CORS

---

### 4. Credential Removal

| File | Change |
|------|--------|
| `lib/supabaseClient.ts` | Removed hardcoded Supabase URL fallback (`https://nbwwqreqmxakevkwzmij.supabase.co`). Removed hardcoded anon key JWT fallback. Removed `console.log` statements leaking config state. Added `throw new Error()` if env vars are missing. |
| `scripts/update-user-metadata.js` | Removed hardcoded Supabase URL (`jbmhvqbwfhvldrfgjqjp.supabase.co`). Removed hardcoded user email PII. Now uses `process.env.SUPABASE_URL` and CLI arguments. |
| `components/AIInsights.tsx` | Removed anon key fallback from Authorization header. Added session check before API call. Removed hardcoded Supabase URL fallback from fetch URL. |
| `components/AIInsightsGrow.tsx` | Same changes as AIInsights.tsx. |

**Addresses:** Audit findings C-2 (hardcoded anon key), M-11 (wrong Supabase URL in script)

---

### 5. SECURITY DEFINER Function Fix

**SQL script (not executed):**
- `sql/fix-merge-function.sql` — Rewrites `merge_duplicate_employees` with:
  - Authentication check (rejects unauthenticated callers)
  - Authorization check (caller must be admin OR belong to same company as both employees)
  - Validation that both employee IDs exist
  - Validation that both employees belong to the same company
  - Added `survey_submissions` to the merge (was missing)
  - `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`
  - `SET search_path = public` to prevent search_path hijacking

**Addresses:** Audit finding C-6 (SECURITY DEFINER bypass)

---

### 6. Write Operation Hardening (Defense in Depth)

| File | Change |
|------|--------|
| `components/EmployeeDashboard.tsx` | Added `.eq('company_id', companyId)` to DELETE, UPDATE (edit), and UPDATE (terminate) operations. |
| `components/ManagerDashboard.tsx` | Added TODO comment noting dependency on `manager_surveys.company_id` column migration. |

`SetupDashboard.tsx` and `lib/useAnalytics.ts` were reviewed and found to already have correct company_id handling — no changes needed.

**Addresses:** Audit finding C-5 (write operations without server-side auth)

---

## Deployment Order

Run these steps in order after reviewing the SQL scripts:

1. **Run `sql/migrate-existing-admins.sql`** — Sets `role='admin'` for existing Boon staff
2. **Run `sql/set-admin-role.sql`** — Creates admin role management functions
3. **Run `sql/rls-policies/000-run-all.sql`** — Enables RLS on all tables (atomic transaction)
4. **Run `sql/fix-merge-function.sql`** — Deploys secured merge function
5. **Deploy code changes** — Push the React app with updated admin checks and credential removal
6. **Deploy edge function** — Push the updated `ai-generate-insights` function
7. **Set `ALLOWED_ORIGIN` env var** on Supabase edge function to your production domain
8. **Verify** — Test all dashboards, admin switching, employee CRUD, AI insights, and exports
9. **Rotate the Supabase anon key** — After confirming RLS works correctly
10. **Remove email domain fallback** — Once all admins have `app_metadata.role = 'admin'` set, remove the `@boon-health.com` fallback from `constants.ts`

---

## Files Changed Summary

**New SQL files (9):**
- `sql/rls-policies/000-run-all.sql`
- `sql/rls-policies/001-enable-rls-all-tables.sql`
- `sql/rls-policies/002-tenant-isolation-policies.sql`
- `sql/rls-policies/003-special-case-policies.sql`
- `sql/rls-policies/004-admin-override-policies.sql`
- `sql/rls-policies/005-drop-existing-policies.sql`
- `sql/set-admin-role.sql`
- `sql/migrate-existing-admins.sql`
- `sql/fix-merge-function.sql`

**Modified source files (18):**
- `constants.ts`
- `App.tsx`
- `lib/supabaseClient.ts`
- `scripts/update-user-metadata.js`
- `supabase/functions/ai-generate-insights/index.ts`
- `components/AIInsights.tsx`
- `components/AIInsightsGrow.tsx`
- `components/HomeDashboard.tsx`
- `components/SessionDashboard.tsx`
- `components/EmployeeDashboard.tsx`
- `components/SetupDashboard.tsx`
- `components/ScaleDashboard.tsx`
- `components/ImpactDashboard.tsx`
- `components/BaselineDashboard.tsx`
- `components/ScaleBaselineDashboard.tsx`
- `components/ThemesDashboard.tsx`
- `components/FeedbackDashboard.tsx`
- `components/ReportGenerator.tsx`
- `components/ManagerDashboard.tsx`
