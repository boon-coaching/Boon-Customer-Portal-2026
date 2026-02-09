# API & Data Fetching Security Audit

**Auditor:** api-auditor
**Date:** 2026-02-08
**Scope:** All Supabase queries in frontend code, edge functions, and utility scripts

---

## Files Reviewed

- `lib/supabaseClient.ts` (20 lines) - Supabase client configuration
- `lib/dataFetcher.ts` (928 lines) - All data fetching functions
- `lib/useAnalytics.ts` - Analytics tracking
- `App.tsx` (866 lines) - Main app with AdminCompanySwitcher
- `components/HomeDashboard.tsx` (1280 lines) - GROW dashboard
- `components/SessionDashboard.tsx` (1479 lines) - Session tracking
- `components/ManagerDashboard.tsx` (689 lines) - Manager view
- `components/EmployeeDashboard.tsx` - Employee roster
- `components/ImpactDashboard.tsx` - Impact metrics
- `components/ThemesDashboard.tsx` - Coaching themes
- `components/BaselineDashboard.tsx` - Baseline survey data
- `components/ScaleBaselineDashboard.tsx` - Scale baseline
- `components/ScaleDashboard.tsx` - Scale program dashboard
- `components/FeedbackDashboard.tsx` - Feedback/survey dashboard
- `components/SetupDashboard.tsx` - Onboarding setup
- `components/ReportGenerator.tsx` (1017 lines) - PDF/CSV export
- `components/AIInsights.tsx` (382 lines) - AI insights (Scale)
- `components/AIInsightsGrow.tsx` (408 lines) - AI insights (GROW)
- `components/ProtectedRoute.tsx` (76 lines) - Auth guard
- `components/LoginPage.tsx` - Login page
- `components/ResetPasswordPage.tsx` - Password reset
- `supabase/functions/ai-generate-insights/index.ts` (287 lines) - Edge function
- `scripts/update-user-metadata.js` (17 lines) - Admin utility script
- `constants.ts` (128 lines) - Constants and mock data
- `types.ts` (276 lines) - TypeScript interfaces

---

## Tables Accessed

| Table | Operations | Filtered by company? |
|-------|-----------|---------------------|
| `employee_manager` | SELECT | Yes (client-side filter via companyId or ilike on company_name) |
| `session_tracking` | SELECT | Yes (client-side filter via companyId or ilike on account_name) |
| `survey_submissions` | SELECT | Yes (client-side filter via companyId or ilike on account_name) |
| `competency_pre_post` | SELECT | Yes (client-side filter via companyId or ilike on account_name) |
| `focus_area_selections` | SELECT | Yes (client-side filter via companyId or ilike on account_name) |
| `competency_scores` | SELECT | Yes (client-side filter via companyId or ilike on account_name) |
| `welcome_survey_baseline` | SELECT | Yes (client-side filter via companyId or ilike on account) |
| `welcome_survey_scale` | SELECT | Yes (client-side filter via companyId or ilike on account) |
| `program_config` | SELECT | Yes (client-side filter via companyId or ilike on account_name) |
| `boon_benchmarks` | SELECT | No - filtered by program_type only (shared benchmark data) |
| `company_logos` | SELECT | Yes (ilike on company_name) |
| `manager_surveys` | SELECT, INSERT | Yes (filtered by manager_email from auth session) |

## Data Mutation Points

Only **two** write operations exist in the entire frontend:
1. **Manager Survey Insert** (`ManagerDashboard.tsx:581-589`): `supabase.from('manager_surveys').insert({...})`
2. **Standard Supabase Auth**: sign in, sign out, password reset

No `.rpc()` calls or raw SQL found anywhere in the frontend code.

---

## CRITICAL FINDINGS

### C1. Hardcoded Supabase Credentials in Source Code

**File:** `lib/supabaseClient.ts:5-6`

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nbwwqreqmxakevkwzmij.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3dxcmVxbXhha2V2a3d6bWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTY2OTUsImV4cCI6MjA4MDk5MjY5NX0.Xd0bdoQHW9oJLznRC6JC7kLevjB5Wh0hYOpRKVPjIq8';
```

- Supabase URL and anon key are hardcoded as fallback values
- These end up in the compiled JavaScript bundle, visible to anyone
- While anon keys are designed to be public, hardcoding means they persist even if env vars are rotated
- Console logging on lines 9-10 confirms credential presence on every page load

**Recommendation:** Remove hardcoded fallbacks. Fail explicitly if env vars are missing. Remove console.log statements.

---

### C2. No Server-Side Company Scoping - Client-Side Filtering Only

**Files:** `lib/dataFetcher.ts` (all query functions), `components/HomeDashboard.tsx:235-244`, `components/SessionDashboard.tsx:182-204`

Every data fetching function in `dataFetcher.ts` relies on client-supplied `CompanyFilter` parameters to scope queries. These filters are derived from `app_metadata` in the JWT, which is reasonable, BUT:

- After data is fetched from Supabase, there is **additional client-side filtering** using `matchesCompany()` helper functions
- `HomeDashboard.tsx:195-226` defines a `matchesCompany()` function that filters results AFTER they arrive in the browser
- `SessionDashboard.tsx:160-178` has its own `matchesCompany()` function doing the same
- This pattern indicates the Supabase queries may return MORE data than the user should see

**Risk:** If RLS policies are absent or misconfigured, a user could intercept the raw API response (via browser dev tools or a proxy) and see data from other companies before client-side filtering removes it.

**Recommendation:** Enforce company-scoped access via RLS policies at the database level. Client-side filtering should be a secondary safeguard, not the primary access control.

---

### C3. Admin Company Switcher Bypasses All Access Controls

**File:** `App.tsx:73-257` (AdminCompanySwitcher component)

- Admin users (any `@boon-health.com` email) can switch to view ANY company's data
- Override is stored in `localStorage` key `boon_admin_company_override`
- Every component reads this override and uses it to build data queries
- Admin detection is client-side only via `isAdminEmail()` in `constants.ts:5-8`:

```typescript
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase().endsWith('@boon-health.com');
};
```

- No server-side enforcement of admin role
- Any compromised `@boon-health.com` account gives unrestricted access to ALL customer data

**Recommendation:** Add server-side admin role verification via `app_metadata.role` in RLS policies. Do not rely solely on email domain checks.

---

## HIGH SEVERITY FINDINGS

### H1. `ilike` Pattern Injection in Company Name Filters

**File:** `lib/dataFetcher.ts` - 13 functions affected

All company name filtering uses unsanitized `ilike` patterns:

```typescript
query = query.ilike('company_name', `%${filter.accountName}%`);
```

**Affected functions (line numbers):**
- `getEmployeeRoster` (line 101)
- `getDashboardSessions` (line 161)
- `getSurveySubmissions` (line 218)
- `getCompetencyPrePost` (line 259)
- `getFocusAreaSelections` (line 299)
- `getBaselineCompetencyScores` (line 342)
- `getCompetencyScores` (line 388)
- `getWelcomeSurveyData` (line 532)
- `getWelcomeSurveyScaleData` (line 608)
- `getProgramConfig` (line 694)
- `getCompanies` (line 838)
- `getPrograms` (line 882)
- `getProgramsForDropdown` (line 912)

For admin users, `accountName` comes from `localStorage` which can be manipulated. Values like `%` or `_%` could match all records.

**Recommendation:** Sanitize inputs by escaping `%` and `_` characters before using in `ilike` filters. Prefer `eq` with exact `company_id` matches over `ilike` with partial name matches.

---

### H2. AdminCompanySwitcher Fetches ALL Company Data

**File:** `App.tsx:81-108`

```typescript
// Paginates through ALL records in session_tracking
while (true) {
  const { data, error } = await supabase
    .from('session_tracking')
    .select('account_name, program_title, company_id')
    .order('account_name')
    .range(from, from + pageSize - 1);
  // ...
}

// Also fetches ALL program_config records
const { data: programsData } = await supabase
  .from('program_config')
  .select('company_id, program_type');
```

- Paginates through the entire `session_tracking` table with no company filter
- Also fetches all `program_config` records
- Exposes every company name, program type, and company_id to any `@boon-health.com` email

**Recommendation:** If admin enumeration is intentional, enforce it via a server-side admin check. Otherwise, restrict to the user's assigned companies.

---

### H3. Fallback Query Strategy Broadens Data Access

**File:** `lib/dataFetcher.ts` - 7 functions affected

Many query functions use a two-stage pattern:

```typescript
// Stage 1: Try company_id
let { data, error } = await query.eq('company_id', filter.companyId);

// Stage 2: If no results, fallback to ilike name match
if (!error && (!data || data.length === 0) && filter?.companyId && fallbackName) {
  fallbackQuery = fallbackQuery.ilike('account_name', `%${fallbackName}%`);
}
```

**Affected functions (with fallback lines):**
- `getSurveySubmissions` (lines 223-235)
- `getCompetencyPrePost` (lines 264-275)
- `getFocusAreaSelections` (lines 304-315)
- `getBaselineCompetencyScores` (lines 346-358)
- `getCompetencyScores` (lines 392-403)
- `getWelcomeSurveyData` (lines 537-548)
- `getWelcomeSurveyScaleData` (lines 616-627)

**Risk:** Partial name matches could leak data across companies with similar names (e.g., "Acme" matching "Acme Corp" and "Acme Labs").

**Recommendation:** Use exact matching instead of `ilike` for fallbacks, or remove fallback pattern entirely once `company_id` is reliably populated.

---

### H4. Manager Dashboard - Unsafe String Interpolation in Query

**File:** `components/ManagerDashboard.tsx:99-102`

```typescript
const { data: sessionData } = await supabase
  .from('session_tracking')
  .select('employee_id, employee_name, session_date, status')
  .or(`employee_name.in.(${employeeNames.map(n => `"${n}"`).join(',')})`);
```

- Employee names are interpolated directly into the PostgREST filter string
- Only wrapped in double quotes, no escaping of special characters
- Names containing `"`, `)`, or `,` could break or manipulate the query

**Recommendation:** Use the Supabase `.in()` filter method instead of string interpolation, or sanitize names before interpolation.

---

### H5. `select('*')` Over-Fetching on All Tables

**File:** `lib/dataFetcher.ts` - virtually every function

Every query function uses `.select('*')`, fetching ALL columns:

```typescript
let query = supabase.from('employee_manager').select('*');
let query = supabase.from('session_tracking').select('*');
let query = supabase.from('survey_submissions').select('*');
// ... etc for all 12 tables
```

This exposes all database columns including potentially sensitive fields not needed by the UI. All data is visible in the browser's Network tab and JavaScript memory.

**Recommendation:** Replace `select('*')` with explicit column lists matching what each component actually needs.

---

## MEDIUM SEVERITY FINDINGS

### M1. Hardcoded Admin Email Exclusion

**File:** `lib/dataFetcher.ts:95`

```typescript
let query = supabase
  .from('employee_manager')
  .select('*')
  .neq('company_email', 'asimmons@boon-health.com');
```

Hardcoded exclusion for a specific admin email. This is a maintenance concern and suggests ad-hoc data filtering.

---

### M2. No Rate Limiting on Data Fetching

**Files:** All dashboard components

- Every dashboard component fetches data on mount with `Promise.all()` making 5-10 parallel Supabase queries
- No debouncing, throttling, or rate limiting
- `getDashboardSessions` batch fetching has no upper bound on pages

---

### M3. AI Insights Edge Function - CORS Allows All Origins

**File:** `supabase/functions/ai-generate-insights/index.ts:6-8`

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Any website can make requests to this edge function with a valid auth token.

**Recommendation:** Restrict to known origins (e.g., the portal's domain).

---

### M4. AI Insights - Auth Token Fallback to Anon Key

**Files:** `components/AIInsights.tsx:174`, `components/AIInsightsGrow.tsx:197`

```typescript
'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
```

Falls back to anon key if no session exists, meaning the edge function could be called without user authentication.

---

### M5. In-Memory Cache Has No Size Limits

**File:** `lib/dataFetcher.ts:27-48`

```typescript
const cache = new Map<string, CacheEntry<any>>();
```

- Cache grows unbounded
- Stale entries only cleaned on access (not proactively)
- TTL is 5 minutes
- Admin users switching between many companies create many cache entries

---

### M6. Script Contains Different Supabase URL

**File:** `scripts/update-user-metadata.js:2`

```javascript
const supabaseUrl = 'https://jbmhvqbwfhvldrfgjqjp.supabase.co';
```

The app uses `https://nbwwqreqmxakevkwzmij.supabase.co`. This appears to be a different or legacy environment, indicating configuration inconsistency.

---

## LOW SEVERITY FINDINGS

### L1. Console Logging of Query Results

**File:** `lib/dataFetcher.ts:119, 191`

```typescript
console.log(`Fetched ${data?.length || 0} employees for company filter:`, filter);
console.log(`Fetched ${allData.length} total sessions for company filter:`, filter);
```

Exposes filter parameters and result counts in the browser console.

---

### L2. Sentry DSN Exposed in Client Code

**File:** `App.tsx:41`

```typescript
dsn: "https://294c2316c823a2c471d7af41681f837c@o4510574332215296.ingest.us.sentry.io/4510574369112064",
```

While Sentry DSNs are designed to be public, it allows anyone to send events to this project.

---

### L3. localStorage Used for Security-Relevant State

**Files:** `App.tsx:63,188,243`, `components/SessionDashboard.tsx:73-83`

- Admin company override: `localStorage.getItem('boon_admin_company_override')`
- Hidden employees: `localStorage.getItem('boon_hidden_employees')`
- Selected program view: `localStorage.getItem('boon_selected_program_view')`

localStorage can be manipulated via browser dev tools or XSS attacks.

---

## RECOMMENDATIONS (Priority Order)

1. **Implement robust RLS policies** on ALL 12 tables to enforce company-scoped access at the database level
2. **Remove hardcoded credentials** from `supabaseClient.ts`; fail explicitly if env vars are missing
3. **Replace `select('*')`** with explicit column lists on every query
4. **Sanitize `ilike` filter inputs** - escape `%` and `_` characters, or prefer exact `eq` matches
5. **Add server-side admin role verification** via `app_metadata.role` rather than email domain checks
6. **Fix Manager Dashboard query** - use `.in()` method instead of string interpolation
7. **Restrict CORS** on edge functions to known portal domains
8. **Remove auth token fallback** to anon key in AI insights components
9. **Add rate limiting** or request debouncing to prevent query abuse
10. **Remove console.log statements** that expose filter parameters and result counts
11. **Add cache size limits** with LRU eviction policy
12. **Remove fallback query pattern** once `company_id` is reliably populated across all tables
