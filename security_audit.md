# Boon Customer Portal - Security & RLS Audit Report

**Date:** 2026-02-08
**Application:** Boon Customer Portal (React + Supabase + Vercel)
**Supabase Project:** `nbwwqreqmxakevkwzmij.supabase.co`
**Architecture:** Multi-tenant SaaS serving enterprise coaching clients, scoped by `company_id`
**Auditors:** 4 specialist agents (RLS, API/Data, Auth/Session, Reporting/Export)

---

## Executive Summary

This audit reveals **fundamental security gaps** in the Boon Customer Portal's multi-tenant data isolation. The most critical finding is that **no Row Level Security (RLS) policies exist on any table** — the entire tenant isolation model relies on client-side JavaScript query filters that can be trivially bypassed. Combined with a hardcoded Supabase anon key in the frontend bundle, any user can query the Supabase REST API directly and access all data across all companies.

Additional critical findings include an **unauthenticated AI edge function**, a **client-side-only admin role check** (email domain matching), and **write operations with no server-side authorization**. A `SECURITY DEFINER` database function for employee merging explicitly bypasses RLS with no authorization checks.

### Finding Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 7 | Active cross-tenant data exposure or complete security bypass |
| **HIGH** | 9 | Missing security controls that should exist |
| **MEDIUM** | 13 | Defense-in-depth gaps, protected by another layer |
| **LOW** | 7 | Best practice recommendations |

---

## CRITICAL Findings

### C-1: No RLS Policies Exist on Any Table

- **Category:** Row Level Security
- **Tables:** ALL tables (employee_manager, session_tracking, survey_submissions, program_config, welcome_survey_baseline, welcome_survey_scale, competency_scores, focus_area_selections, portal_events, onboarding_tasks, manager_surveys, company_logos, company_account_team, boon_benchmarks, competency_pre_post)
- **Risk:** Complete cross-tenant data exposure. Without RLS, any authenticated user can read, insert, update, or delete data belonging to ANY company by making direct Supabase REST API calls. The anon key is publicly exposed (see C-2), enabling this without even needing a user account.
- **Evidence:**
  - Zero `CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, or `FORCE ROW LEVEL SECURITY` statements found in any SQL script or migration file
  - Comments in `App.tsx:437` and `App.tsx:495` suggest RLS was attempted but abandoned: `"// Get program type from JWT app_metadata (no DB query needed - avoids RLS issues)"` and `"// Note: program_config fallback removed due to RLS/API key issues"`
  - `lib/dataFetcher.ts:810-811` returns an empty filter with comment: `"// No filter - will return all data (should not happen in practice)"`
- **Recommendation:** Enable RLS on every table immediately. Create policies enforcing `company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid` for SELECT/INSERT/UPDATE/DELETE. Add admin override policies checking `auth.jwt()->'app_metadata'->>'role' = 'admin'`. See remediation template at end of report.

### C-2: Hardcoded Supabase Anon Key in Frontend Source Code

- **Category:** Credentials
- **File:** `lib/supabaseClient.ts:5-6`
- **Risk:** The full Supabase anon JWT is hardcoded as a fallback value in source code shipped to every browser. The token decodes to `{"role":"anon","exp":2080992695}` (expires 2035). Without RLS, this key grants unrestricted read/write access to all tables via the public REST API. The key cannot be rotated without a code deployment.
- **Evidence:**
  ```typescript
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nbwwqreqmxakevkwzmij.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIs...';
  ```
  Console logging on lines 9-10 also confirms credential presence on every page load.
- **Recommendation:** Remove hardcoded fallbacks. Fail explicitly if env vars are missing. Enable RLS so the anon key is safe to be public (Supabase's intended design). Rotate the anon key after RLS is enabled.

### C-3: Admin Role Determined by Client-Side Email Domain Check Only

- **Category:** Access Control
- **Files:** `constants.ts:4-8`, `App.tsx:310-311`, 12+ component files
- **Risk:** Admin status is determined entirely by checking if the email ends with `@boon-health.com`. There is no server-side enforcement — no JWT claim, no RLS policy, no edge function validation. Anyone who registers with a `@boon-health.com` email gets admin access. Since self-registration is enabled (see M-5), this is trivially exploitable. Admin access grants visibility into ALL company data via the company switcher.
- **Evidence:**
  ```typescript
  // constants.ts
  export const isAdminEmail = (email) => email.toLowerCase().endsWith('@boon-health.com');

  // Pattern repeated in 12+ components:
  const isAdmin = isAdminEmail(email);
  if (isAdmin) {
    const stored = localStorage.getItem('boon_admin_company_override');
    // Use override to fetch ANY company's data
  }
  ```
- **Recommendation:** Add a proper `role` claim in Supabase `app_metadata` (settable only via server-side admin API). Use it in RLS policies: `auth.jwt()->'app_metadata'->>'role' = 'admin'`. Remove the email domain check from client code entirely.

### C-4: Admin Company Switcher Has No Server-Side Validation

- **Category:** Access Control
- **File:** `App.tsx:62-257`
- **Risk:** The admin company switcher fetches ALL companies from `session_tracking` and `program_config` (enumerating every customer), then stores the selected company override in `localStorage`. All subsequent data queries use this localStorage value. There is zero server-side validation — the authorization decision is made entirely in the browser.
- **Evidence:**
  ```typescript
  // Fetches ALL session_tracking records to build company list
  const { data } = await supabase
    .from('session_tracking')
    .select('account_name, program_title, company_id')
    .order('account_name')
    .range(from, from + pageSize - 1);

  // Stores override in localStorage
  localStorage.setItem('boon_admin_company_override', JSON.stringify(company));
  ```
- **Recommendation:** Implement server-side admin authorization via RLS policies. The company list should only be accessible to verified admin users. Log all company-switch events.

### C-5: Write Operations Have No Server-Side Authorization

- **Category:** Data Integrity
- **Tables:** employee_manager, portal_events, onboarding_tasks, program_config, manager_surveys
- **Risk:** The application performs INSERT, UPDATE, DELETE, and UPSERT operations on multiple tables with no RLS policies to restrict which company's data can be modified. Any authenticated user can modify any company's data.
- **Evidence:**
  - `EmployeeDashboard.tsx:914-918` — DELETE uses `.eq('id', employee.id)` with no company_id check
  - `EmployeeDashboard.tsx:932-941` — INSERT with client-supplied `company_id` (not validated server-side)
  - `EmployeeDashboard.tsx:1383-1386` — Batch upload inserts employees with no server-side validation
  - `SetupDashboard.tsx:352-355` — UPDATE program_config with client-supplied companyId
  - `SetupDashboard.tsx:367-373` — UPSERT onboarding_tasks for any company
  - `ManagerDashboard.tsx:581-589` — INSERT manager_survey with no company_id at all
- **Recommendation:** Enable RLS with write policies. INSERT: require `company_id` matches JWT. UPDATE/DELETE: require existing row's `company_id` matches JWT. For admin operations, use SECURITY DEFINER functions with explicit role checks.

### C-6: SECURITY DEFINER Function Bypasses All Access Control

- **Category:** Row Level Security
- **Tables:** employee_manager, session_tracking, welcome_survey_scale, welcome_survey_baseline
- **File:** `scripts/fix-employee-duplicate-merge.sql:66-116`, called from `EmployeeDashboard.tsx:383-387`
- **Risk:** The `merge_duplicate_employees` function runs with `SECURITY DEFINER` (superuser privileges), completely bypassing RLS. It accepts arbitrary `keep_employee_id` and `delete_employee_id` parameters with no authorization checks. Any authenticated user calling `supabase.rpc('merge_duplicate_employees', {...})` can delete any employee and reassign their data across companies.
- **Evidence:**
  ```typescript
  // EmployeeDashboard.tsx:383-387
  const { error } = await supabase.rpc('merge_duplicate_employees', {
    keep_employee_id: keepId,
    delete_employee_id: deleteId
  });
  // Comment: "// Use RPC function to merge employees (bypasses RLS)"
  ```
- **Recommendation:** Add authorization checks inside the function (verify caller's company_id matches both employees). Restrict to admin role. Consider using `SECURITY INVOKER` instead.

### C-7: AI Edge Function Has No Authentication

- **Category:** API Security
- **File:** `supabase/functions/ai-generate-insights/index.ts:1-40`
- **Risk:** The edge function accepts POST requests from any origin (`Access-Control-Allow-Origin: *`) without validating a JWT or checking company membership. Any unauthenticated caller can invoke it with arbitrary company data. The Authorization header is sent by the client but never validated server-side.
- **Evidence:**
  ```typescript
  serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    // NO JWT validation — goes straight to parsing body
    const { companyName, companyId, internalData, programType, programPhase } = await req.json();
    // Proceeds to call Claude API with this data
  });
  ```
  Client-side fallback (`AIInsights.tsx:174`):
  ```typescript
  'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
  ```
- **Recommendation:** Add JWT validation using `supabase.auth.getUser(token)`. Extract and verify `company_id` from the JWT's `app_metadata`. Reject requests with only the anon key. Restrict CORS to production domains.

---

## HIGH Findings

### H-1: `ilike` Partial Matching Enables Cross-Tenant Data Leakage

- **Category:** Data Isolation
- **File:** `lib/dataFetcher.ts` — 13 functions affected
- **Risk:** All company name filtering uses `ilike('column', '%companyName%')` with wildcards. This means "Acme" matches "Acme Corp", "Acme Labs", and "Acme International". For admin users, the `accountName` comes from localStorage and could be manipulated to contain `%` (match everything) or `_%` (match all non-empty).
- **Affected functions:** `getEmployeeRoster` (ln 101), `getDashboardSessions` (ln 161), `getSurveySubmissions` (ln 218), `getCompetencyPrePost` (ln 259), `getFocusAreaSelections` (ln 299), `getBaselineCompetencyScores` (ln 342), `getCompetencyScores` (ln 388), `getWelcomeSurveyData` (ln 532), `getWelcomeSurveyScaleData` (ln 608), `getProgramConfig` (ln 694), `getCompanies` (ln 838), `getPrograms` (ln 882), `getProgramsForDropdown` (ln 912)
- **Recommendation:** Replace `ilike` with exact `eq` matching on `company_id` (UUID). Escape `%` and `_` in any remaining `ilike` filters.

### H-2: Fallback Query Strategy Broadens Data Access

- **Category:** Data Isolation
- **File:** `lib/dataFetcher.ts` — 7 functions affected
- **Risk:** When `company_id` returns no results, many functions retry with `ilike` name matching, broadening the query scope. This can return data for similarly-named companies.
- **Affected functions:** `getSurveySubmissions` (ln 223-235), `getCompetencyPrePost` (ln 264-275), `getFocusAreaSelections` (ln 304-315), `getBaselineCompetencyScores` (ln 346-358), `getCompetencyScores` (ln 392-403), `getWelcomeSurveyData` (ln 537-548), `getWelcomeSurveyScaleData` (ln 616-627)
- **Recommendation:** Remove fallback pattern. Use exact `company_id` matching only. Backfill missing `company_id` values in the database.

### H-3: Manager Dashboard Queries Lack Company Scoping

- **Category:** Data Isolation
- **File:** `components/ManagerDashboard.tsx:72-111, 581-589`
- **Risk:** All manager queries filter by `manager_email` only — no `company_id` filter. The `manager_surveys` table has no `company_id` column at all. If the same email exists across companies, data leaks.
- **Recommendation:** Add `company_id` filtering to all manager queries. Add `company_id` column to `manager_surveys`.

### H-4: Unsafe String Interpolation in Manager Query

- **Category:** Injection
- **File:** `components/ManagerDashboard.tsx:99-102`
- **Risk:** Employee names are interpolated directly into a PostgREST filter string with only quote wrapping. Names containing `"`, `)`, or `,` could break or manipulate the query.
- **Evidence:**
  ```typescript
  query = query.or(`employee_name.in.(${employeeNames.map(n => `"${n}"`).join(',')})`);
  ```
- **Recommendation:** Use Supabase's `.in()` method instead of string interpolation.

### H-5: `select('*')` Over-Fetching on All Tables

- **Category:** Data Exposure
- **File:** `lib/dataFetcher.ts` — every query function
- **Risk:** All queries use `.select('*')`, exposing every column in the browser's Network tab and JavaScript memory, including fields the UI doesn't need.
- **Recommendation:** Replace with explicit column lists matching what each component actually renders.

### H-6: No Rate Limiting on Login Attempts

- **Category:** Authentication
- **File:** `components/LoginPage.tsx:37-61`
- **Risk:** No client-side rate limiting, lockout mechanism, or CAPTCHA on the login form. Enables credential stuffing and brute-force attacks.
- **Recommendation:** Add exponential backoff after 3 failures. Add CAPTCHA. Configure Supabase Auth rate limiting.

### H-7: Weak Password Policy (6-Character Minimum)

- **Category:** Authentication
- **Files:** `LoginPage.tsx:74-78`, `ResetPasswordPage.tsx:34-38`
- **Risk:** Minimum password length is 6 characters with no complexity requirements.
- **Recommendation:** Enforce 12+ character minimum with complexity requirements. Integrate HIBP API. Enforce server-side in Supabase Auth config.

### H-8: No Server-Side Route Authorization

- **Category:** Access Control
- **File:** `App.tsx:778-800`
- **Risk:** All routes within `MainPortalLayout` are accessible to any authenticated user. Navigation items are conditionally hidden client-side, but route definitions have no role-based guards. URL manipulation reaches any route.
- **Recommendation:** Implement route-level authorization guards. With RLS in place, unauthorized routes would return empty data, but explicit guards are still best practice.

### H-9: External CDN Dependencies Without SRI

- **Category:** Supply Chain
- **File:** `index.html:8, 36-52`
- **Risk:** All dependencies (React, Supabase JS, Tailwind, Sentry) are loaded from external CDNs (`esm.sh`, `cdn.tailwindcss.com`) with no Subresource Integrity (SRI) hashes. A compromised CDN could inject arbitrary JavaScript with access to auth tokens and all data.
- **Recommendation:** Bundle dependencies locally via Vite. If CDNs are required, add SRI hashes. Implement Content Security Policy headers.

---

## MEDIUM Findings

### M-1: Client-Side PDF/CSV Generation Bypasses Server Authorization

- **File:** `components/ReportGenerator.tsx` (entire file, ~1017 lines)
- **Risk:** Reports and CSV exports are generated entirely client-side using jsPDF and Blob downloads. No server-side endpoint validates export authorization or logs the event. PII (employee names, coach names, session data) is exported with no audit trail.
- **Recommendation:** Add server-side export endpoint with JWT validation and audit logging.

### M-2: Prompt Injection Risk in AI Insights

- **Files:** `AIInsights.tsx`, `AIInsightsGrow.tsx`, `ai-generate-insights/index.ts`
- **Risk:** User-controlled feedback text, theme names, and company names are passed unsanitized into Claude prompts via the `internalData` field. A malicious actor who controls database content could inject prompt instructions.
- **Recommendation:** Sanitize `internalData` server-side. Use structured data (JSON) instead of free text. Apply output validation.

### M-3: AI Web Search Leaks Company Names to External Services

- **File:** `supabase/functions/ai-generate-insights/index.ts:45-80`
- **Risk:** The edge function performs web searches using the company name, exposing which companies use Boon's platform to external search providers.
- **Recommendation:** Make web search opt-in. Cache results. Consider curated company profiles.

### M-4: Open Self-Registration Enabled

- **File:** `components/LoginPage.tsx:63-109`
- **Risk:** Anyone can create an account via the sign-up form. For a B2B multi-tenant SaaS, this means unauthorized users can obtain authenticated sessions. Combined with the admin email domain check (C-3), an attacker registering with `@boon-health.com` gets admin access.
- **Recommendation:** Disable open self-registration. Implement invite-only provisioning. Require email verification before any data access.

### M-5: No Content Security Policy Headers

- **File:** `index.html`, `vercel.json`
- **Risk:** No CSP headers restrict script sources, maximizing the attack surface for XSS and code injection. Combined with CDN usage, this is especially risky.
- **Recommendation:** Add strict CSP via `vercel.json` headers configuration.

### M-6: Session Tokens in localStorage (Supabase Default)

- **File:** `lib/supabaseClient.ts:13-19`
- **Risk:** Auth tokens are stored in `localStorage`, accessible to any JavaScript on the page including XSS payloads and malicious browser extensions. Since the app loads external CDN scripts, a compromised CDN could exfiltrate tokens.
- **Recommendation:** Configure PKCE auth flow. Explore httpOnly cookie-based session storage via backend proxy.

### M-7: No Explicit Session Expiry Configuration

- **File:** `lib/supabaseClient.ts`, `components/ProtectedRoute.tsx`
- **Risk:** No custom session timeout, idle timeout, or absolute session lifetime. Relies entirely on Supabase defaults (1hr JWT with auto-refresh). No re-authentication for sensitive admin operations.
- **Recommendation:** Implement idle timeout (30min) and absolute session lifetime (8hr). Require re-auth for admin operations.

### M-8: Gemini API Key Exposed in Client Bundle

- **File:** `vite.config.ts:13-15`
- **Risk:** The Vite config injects `GEMINI_API_KEY` into the client-side bundle via `define`, making it visible to any user.
- **Recommendation:** Move Gemini API calls to a server-side function. Never expose API keys in client bundles.

### M-9: Portal Events Table Allows Activity Tracking Forgery

- **Table:** portal_events
- **File:** `lib/useAnalytics.ts:72-79`
- **Risk:** Without RLS, any user can insert fake activity events for other users/companies and read all portal activity across all companies (revealing customer list and engagement patterns).
- **Recommendation:** Enable RLS. INSERT: `user_id = auth.uid()`. SELECT: admin only.

### M-10: Database Views Without Security Barriers

- **Tables:** portal_activity_by_client, portal_activity_by_user, portal_event_summary
- **File:** `scripts/create-portal-events-view.sql`
- **Risk:** Views aggregate data across all clients/users with no `security_barrier` option. Exposes company list, user emails, and activity patterns.
- **Recommendation:** Add `WITH (security_barrier)`. Restrict view access to admin/service_role only.

### M-11: Admin Utility Script Points to Wrong Supabase Instance

- **File:** `scripts/update-user-metadata.js:2`
- **Risk:** Uses `https://jbmhvqbwfhvldrfgjqjp.supabase.co` while the app uses `https://nbwwqreqmxakevkwzmij.supabase.co`. Contains hardcoded user email (`jay.kantar@mediaartslab.com`). Uses service_role key.
- **Recommendation:** Use environment variables for URLs. Remove PII from committed code.

### M-12: No Rate Limiting on Password Reset

- **File:** `components/LoginPage.tsx:111-131`
- **Risk:** Reset emails can be sent without rate limiting. Different error messages for valid vs invalid emails enable account enumeration.
- **Recommendation:** Rate limit to 1 request per email per 60 seconds. Return generic success messages.

### M-13: User PII Sent to Sentry Without Consent

- **File:** `App.tsx:353-358`
- **Risk:** User email and ID sent to Sentry. May violate GDPR/CCPA requirements.
- **Recommendation:** Use anonymized user IDs. Add consent mechanism.

---

## LOW Findings

### L-1: Console Logging Exposes Filter Parameters

- **File:** `lib/dataFetcher.ts:119, 191`
- **Risk:** Query results and filter parameters logged to browser console.
- **Recommendation:** Remove or gate behind `import.meta.env.DEV`.

### L-2: Hardcoded Admin Email Exclusion

- **File:** `lib/dataFetcher.ts:95`
- **Risk:** `.neq('company_email', 'asimmons@boon-health.com')` — ad-hoc filtering suggests data quality issues.
- **Recommendation:** Remove hardcoded exclusion. Handle admin filtering via RLS.

### L-3: localStorage Used for Security-Relevant State

- **Files:** `App.tsx:63,188,243`, `SessionDashboard.tsx:73-83`
- **Risk:** Admin company override, hidden employees, and program view stored in manipulable localStorage.
- **Recommendation:** Validate localStorage values server-side or move to session state.

### L-4: Sentry DSN Hardcoded in Source

- **File:** `App.tsx:41`
- **Risk:** Allows anyone to send events to the Sentry project.
- **Recommendation:** Move to environment variable. Configure Sentry allowed origins.

### L-5: Debug Logging Exposes Configuration State

- **File:** `lib/supabaseClient.ts:9-10`
- **Risk:** Logs whether Supabase URL and key are configured.
- **Recommendation:** Remove or gate behind `import.meta.env.DEV`.

### L-6: Benchmark Table Has No Write Protection

- **Table:** boon_benchmarks
- **Risk:** Global benchmark data can be modified by any authenticated user without RLS.
- **Recommendation:** Enable RLS. SELECT: all authenticated users. INSERT/UPDATE/DELETE: admin/service_role only.

### L-7: In-Memory Cache Has No Size Limits

- **File:** `lib/dataFetcher.ts:27-48`
- **Risk:** Cache grows unbounded. Admin users switching between many companies create many entries. TTL is 5min but stale entries only cleaned on access.
- **Recommendation:** Add max size with LRU eviction. Clear cache on company switch.

---

## Table-by-Table RLS Status

| Table | RLS Enabled | Operations | Company Scope | Status |
|-------|:-----------:|------------|:-------------:|--------|
| employee_manager | NO | SELECT, INSERT, UPDATE, DELETE | company_id | NEEDS RLS |
| session_tracking | NO | SELECT | company_id | NEEDS RLS |
| survey_submissions | NO | SELECT | company_id | NEEDS RLS |
| program_config | NO | SELECT, UPDATE | company_id | NEEDS RLS |
| welcome_survey_baseline | NO | SELECT | company_id | NEEDS RLS |
| welcome_survey_scale | NO | SELECT | company_id | NEEDS RLS |
| competency_scores | NO | SELECT | company_id | NEEDS RLS |
| competency_pre_post (view) | N/A | SELECT | company_id | Apply to underlying tables |
| focus_area_selections | NO | SELECT | company_id | NEEDS RLS |
| portal_events | NO | INSERT | client_id | NEEDS RLS |
| onboarding_tasks | NO | SELECT, UPSERT | company_id | NEEDS RLS |
| manager_surveys | NO | SELECT, INSERT | NONE | NEEDS company_id column + RLS |
| company_logos | NO | SELECT | company_name | NEEDS RLS |
| company_account_team | NO | SELECT | unknown | NEEDS RLS |
| boon_benchmarks | NO | SELECT | NONE (shared) | NEEDS write protection |

---

## Remediation Roadmap

### Phase 1: Critical (This Week)

1. **Enable RLS on ALL tables** with company_id isolation policies
2. **Add admin role to `app_metadata`** via Supabase admin API (not email domain)
3. **Add JWT validation to AI edge function**
4. **Add authorization checks to `merge_duplicate_employees` function**
5. **Restrict CORS on edge functions** to production domain
6. **Remove hardcoded credentials** from `supabaseClient.ts`
7. **Rotate the Supabase anon key** after confirming RLS works

### Phase 2: High Priority (Weeks 2-3)

8. **Replace all `ilike` with exact `company_id` matching** across dataFetcher.ts
9. **Remove fallback query patterns** — backfill missing company_id values
10. **Fix Manager Dashboard** — add company_id column to manager_surveys, use `.in()` instead of string interpolation
11. **Replace `select('*')` with explicit columns** on all queries
12. **Add rate limiting and CAPTCHA** to login and password reset
13. **Strengthen password policy** to 12+ characters with complexity
14. **Disable open self-registration** or restrict to pre-approved domains

### Phase 3: Defense in Depth (Month 1)

15. **Bundle dependencies locally** via Vite build instead of CDN loading
16. **Implement Content Security Policy** headers via vercel.json
17. **Add server-side export endpoint** with audit logging for PDF/CSV exports
18. **Implement idle and absolute session timeouts**
19. **Centralize authorization** in a React context provider
20. **Add route-level authorization guards** for admin-only pages
21. **Move Gemini API key** to server-side function
22. **Add `security_barrier`** to database views
23. **Remove debug console.log** statements and hardcoded email exclusions
24. **Sanitize AI prompt inputs** to prevent prompt injection

### RLS Policy Template

```sql
-- Apply this pattern to each table (replace table_name and adjust operations):

ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

-- Regular users: company-scoped access
CREATE POLICY "tenant_isolation_select" ON table_name
  FOR SELECT USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_insert" ON table_name
  FOR INSERT WITH CHECK (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_update" ON table_name
  FOR UPDATE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

CREATE POLICY "tenant_isolation_delete" ON table_name
  FOR DELETE USING (
    company_id = (auth.jwt()->'app_metadata'->>'company_id')::uuid
  );

-- Admin override: Boon staff with verified admin role
CREATE POLICY "admin_full_access" ON table_name
  FOR ALL USING (
    auth.jwt()->'app_metadata'->>'role' = 'admin'
  );
```

**Special cases:**
- `portal_events`: Use `client_id` instead of `company_id`
- `manager_surveys`: Add `company_id` column first, then apply policies
- `boon_benchmarks`: SELECT for all authenticated; write restricted to admin
- `competency_pre_post`: Apply RLS to underlying tables (this is a view)

---

## Methodology

This audit was conducted by 4 specialist agents working in parallel:

1. **RLS Policy Auditor** — Reviewed all 9 SQL scripts, data models, edge functions, and searched for RLS-related keywords across the entire codebase
2. **API & Data Fetching Auditor** — Reviewed every Supabase query across all 18 component files, lib/dataFetcher.ts (928 lines), and the edge function
3. **Auth & Session Security Auditor** — Reviewed the complete authentication flow, session management, RBAC implementation, credentials handling, and route protection
4. **Reporting & Export Security Auditor** — Reviewed PDF generation, AI insights features, CSV exports, and cross-tenant data handling in reports

**Total files reviewed:** 28 source files (~19,000 lines of code) + 9 SQL scripts (~2,750 lines)

---

*This report was generated on 2026-02-08. Individual audit reports are available in `audit_rls.md`, `audit_api.md`, `audit_auth.md`, and `audit_exports.md`.*
