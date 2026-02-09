# Security Audit: Reporting, Export & AI Features — Cross-Tenant Data Leakage

**Auditor:** Agent 4 — Reporting & Export Security Auditor
**Scope:** PDF report generation, AI insights, CSV/data exports, feedback/survey data, billing/financial data
**Date:** 2026-02-08

---

## Executive Summary

The Boon Customer Portal relies heavily on **client-side company filtering** using `ilike` partial string matching against Supabase. The central assumption is that Supabase Row Level Security (RLS) is the primary enforcement boundary, but several paths bypass or weaken that assumption. The most critical finding is that the **AI edge function has no authentication or authorization at all**, meaning any unauthenticated caller can invoke it. Additional high-severity issues include partial-match filtering that can leak data across tenants with similar names, and CSV/PDF exports that contain PII with no server-side audit trail.

**Finding Count by Severity:**
- CRITICAL: 2
- HIGH: 5
- MEDIUM: 5
- LOW: 2

---

## A) PDF Report Generation

### [HIGH] Client-Side PDF/CSV Generation Bypasses Server-Side Authorization
- **File:** `/components/ReportGenerator.tsx` (entire file, ~1017 lines)
- **Risk:** PDF reports and CSV exports are generated entirely on the client side using jsPDF and Blob downloads. There is no server-side endpoint that validates whether the requesting user is authorized to export data for the selected company. An attacker who obtains a valid session token (or an admin who switches companies) can export any company's data without server-side logging or rate limiting.
- **Evidence:**
  ```typescript
  // ReportGenerator.tsx — CSV generation
  const generateSessionCSV = async () => {
    // ... fetches data via getDashboardSessions(companyFilter)
    // ... builds CSV string client-side
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    // ... triggers download via anchor click
  };
  ```
  The company filter is derived from the client-side auth session and admin override in localStorage — no server endpoint validates the export request.
- **Recommendation:** Introduce a server-side export endpoint (Supabase Edge Function or API route) that validates the user's JWT, confirms company membership via `app_metadata`, logs the export event with user ID and company, and generates the file server-side before returning it. At minimum, add an audit log entry for every export.

### [MEDIUM] PII Exposed in CSV Exports Without Audit Trail
- **File:** `/components/ReportGenerator.tsx`, lines 130–180 (CSV column construction)
- **Risk:** The CSV export includes employee full names, coach names, session dates, session counts, and registration status. This constitutes PII/PHI-adjacent data being downloaded to the user's local machine with no audit trail, no watermarking, and no expiration.
- **Evidence:**
  ```typescript
  const csvContent = [
    headers.join(','),
    ...sessionData.map(s => [
      `"${s.employee_name || ''}"`,
      `"${s.coach_name || ''}"`,
      `"${s.total_sessions || 0}"`,
      // ... more fields
    ].join(','))
  ].join('\n');
  ```
- **Recommendation:** Log all export events server-side (user, company, timestamp, row count). Consider watermarking exports with the requesting user's identity. Implement a data classification policy and restrict PII exports to authorized roles.

---

## B) AI Insights Security

### [CRITICAL] AI Edge Function Has No Authentication or Authorization
- **File:** `/supabase/functions/ai-generate-insights/index.ts`, lines 1–40 (request handling)
- **Risk:** The edge function accepts POST requests from any origin without validating a JWT or checking that the caller belongs to the company whose data is being analyzed. Any unauthenticated user (or external attacker) can call this endpoint with arbitrary `companyName`, `companyId`, and `internalData` values to generate AI insights or probe the system.
- **Evidence:**
  ```typescript
  // ai-generate-insights/index.ts
  serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    // NO JWT validation here — goes straight to parsing body
    const { companyName, companyId, internalData, programType, programPhase } = await req.json();
    // ... proceeds to call Anthropic API with this data
  });
  ```
  Compare with the client-side call in `AIInsights.tsx`:
  ```typescript
  'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
  ```
  The Authorization header is sent but **never validated** on the server side.
- **Recommendation:** Add JWT validation at the top of the edge function using `supabase.auth.getUser(token)`. Extract `company_id` from the JWT's `app_metadata` and reject requests where the `companyId` in the body does not match. Deny requests with only the anon key.

### [HIGH] CORS Allows All Origins on AI Edge Function
- **File:** `/supabase/functions/ai-generate-insights/index.ts`, line 3–7
- **Risk:** The CORS configuration permits requests from any origin, which combined with the lack of authentication means the AI endpoint is fully open to cross-origin exploitation.
- **Evidence:**
  ```typescript
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  ```
- **Recommendation:** Restrict `Access-Control-Allow-Origin` to the production domain(s) only (e.g., `https://portal.boonhealth.com`). Use an allowlist for development/staging origins.

### [HIGH] Prompt Injection Risk via Unsanitized Internal Data
- **File:** `/supabase/functions/ai-generate-insights/index.ts`, line ~235; `/components/AIInsights.tsx`, `buildInternalDataSummary()`; `/components/AIInsightsGrow.tsx`, `buildInternalDataSummary()`
- **Risk:** The `internalData` field is a free-text string constructed client-side from database values (company names, feedback quotes, theme names) and passed directly into the Claude prompt without sanitization. A malicious actor who can control feedback text, theme names, or company names in the database could inject prompt instructions that alter AI output, extract system prompt contents, or generate misleading insights.
- **Evidence:**
  ```typescript
  // AIInsights.tsx — buildInternalDataSummary()
  if (feedbackHighlights.length > 0) {
    parts.push(`Participant Feedback Highlights:`);
    feedbackHighlights.forEach(fb => {
      const text = (fb.feedback_learned || fb.feedback_insight || '').substring(0, 200);
      parts.push(`- "${text}"`);
    });
  }
  ```
  This text is sent directly to the edge function and embedded in the Claude prompt:
  ```typescript
  // ai-generate-insights/index.ts
  messages: [{
    role: "user",
    content: `Generate a coaching program insights report...
    Internal program data:\n${internalData}`
  }]
  ```
- **Recommendation:** Sanitize `internalData` on the server side: strip control characters, limit length, and use structured data (JSON) instead of free text in prompts. Consider using Claude's system prompt to establish injection-resistant boundaries. Apply output validation before returning results.

### [MEDIUM] AI Web Search Leaks Company Name to External Services
- **File:** `/supabase/functions/ai-generate-insights/index.ts`, lines 45–80 (web search step)
- **Risk:** The edge function performs a web search using the company name to gather context. This leaks the fact that a specific company is using Boon's coaching platform to whatever search provider is used, and the search results could be manipulated to influence AI output.
- **Evidence:**
  ```typescript
  // First Claude call with web search
  content: `Search the web for information about ${companyName}...`
  ```
- **Recommendation:** Make web search opt-in per company. Cache web search results to reduce external exposure. Consider using a curated company profile instead of live web search.

---

## C) CSV/Data Export

### [HIGH] ilike Partial Matching Enables Cross-Tenant Data Leakage
- **File:** `/lib/dataFetcher.ts`, lines 780–812 (`buildCompanyFilter`); used throughout all dashboard components
- **Risk:** Company filtering uses PostgreSQL `ilike` with wildcard wrapping (`%name%`). If two companies have overlapping names (e.g., "Acme" and "Acme Industries" and "Acme Corp"), queries for one company may return rows belonging to another. This is the most pervasive cross-tenant risk in the application.
- **Evidence:**
  ```typescript
  // dataFetcher.ts — buildCompanyFilter application
  if (filter.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }
  ```
  This pattern is repeated in direct queries throughout:
  ```typescript
  // SessionDashboard.tsx, line ~140
  query = query.ilike('account_name', `%${companyBase}%`);

  // HomeDashboard.tsx, similar pattern
  query = query.ilike('account_name', `%${companyBase}%`);
  ```
- **Recommendation:** Replace `ilike` partial matching with exact `eq` matching on `company_id` (UUID). The `company_id` field exists in most tables and provides unambiguous tenant isolation. Where `company_id` is not available, use exact `eq` matching on `account_name` instead of `ilike`. Audit all existing data to ensure `company_id` is populated consistently.

### [HIGH] Admin Company Switcher Fetches All Companies Without Server Enforcement
- **File:** `/App.tsx`, lines 83–108 (`AdminCompanySwitcher` component)
- **Risk:** The admin company switcher fetches all distinct `account_name` values from `session_tracking` with no server-side restriction. The selected company override is stored in localStorage and used to filter all subsequent queries. There is no server-side validation that the admin user is authorized to view a specific company's data — the override is purely client-side.
- **Evidence:**
  ```typescript
  // App.tsx — AdminCompanySwitcher
  const { data } = await supabase
    .from('session_tracking')
    .select('account_name')
    // No company filter — fetches ALL companies
  ```
  And the override is stored as:
  ```typescript
  localStorage.setItem('boon_admin_company_override', JSON.stringify(override));
  ```
- **Recommendation:** Implement server-side admin authorization. Create an `admin_company_access` table or use RLS policies that limit which companies an admin can access. The company list endpoint should be a server-side function that validates admin permissions. At minimum, log all admin company-switch events.

---

## D) Feedback & Survey Data

### [MEDIUM] Feedback Text Displayed Verbatim Without Sanitization
- **File:** `/components/FeedbackDashboard.tsx` (qualitative quotes section); `/components/ImpactDashboard.tsx` (TestimonialsSection); `/components/ScaleDashboard.tsx` (ScaleTestimonialsSection)
- **Risk:** Participant feedback text from `feedback_learned`, `feedback_insight`, and similar fields is rendered directly in React JSX. While React auto-escapes HTML by default (preventing basic XSS), the text could contain misleading or inappropriate content injected by participants that gets displayed to company admins. If any rendering path uses `dangerouslySetInnerHTML`, it would become a stored XSS vector.
- **Evidence:**
  ```typescript
  // ImpactDashboard.tsx — TestimonialsSection
  {testimonials.map((t, i) => (
    <div key={i}>
      <p>{t.feedback_text}</p>
    </div>
  ))}
  ```
- **Recommendation:** While React's default escaping provides baseline XSS protection, add a content moderation or sanitization step for user-generated feedback before storage. Ensure no path uses `dangerouslySetInnerHTML` for feedback content. Consider truncating extremely long feedback entries.

### [MEDIUM] Welcome Survey Baseline Queries Use Direct ilike Without Central Filter
- **File:** `/components/SessionDashboard.tsx`, lines 137–153; `/components/HomeDashboard.tsx` (welcome survey queries)
- **Risk:** Some components query `welcome_survey_baseline` directly with inline `ilike` rather than using the centralized `dataFetcher.ts` functions. This creates inconsistency in how company filtering is applied and increases the risk of a filtering mistake in one component leaking data.
- **Evidence:**
  ```typescript
  // SessionDashboard.tsx — direct query
  let query = supabase
    .from('welcome_survey_baseline')
    .select('*');
  if (companyBase) {
    query = query.ilike('account_name', `%${companyBase}%`);
  }
  ```
- **Recommendation:** Route all data queries through `dataFetcher.ts` to ensure consistent company filtering. Remove direct Supabase queries from component files. This centralizes the filtering logic and makes it easier to audit and update.

---

## E) Billing & Financial Data

### [LOW] No Billing or Financial Data Found in Audited Components
- **File:** All 12 audited files
- **Risk:** No billing, invoicing, or financial data endpoints were found in the audited components. If billing data exists elsewhere in the system, it was not in scope for this audit.
- **Recommendation:** Confirm whether billing/financial features exist in other parts of the application and ensure they receive a separate security review.

---

## Additional Cross-Cutting Findings

### [CRITICAL] Supabase RLS May Not Be Enforced — No Evidence of Policies in Codebase
- **File:** All data access paths; `/lib/dataFetcher.ts`; all dashboard components
- **Risk:** The entire application relies on client-side query filtering (adding `.ilike()` or `.eq()` to Supabase queries) for tenant isolation. If Supabase Row Level Security (RLS) policies are not configured on the underlying PostgreSQL tables, then the `ilike` filters are the **only** barrier preventing cross-tenant access. An attacker who modifies client-side JavaScript or crafts direct API calls to the Supabase REST API could bypass all filtering. No RLS policy definitions were found in the codebase (no migration files, no SQL policy definitions).
- **Evidence:**
  The application uses the Supabase anon key for all client-side queries:
  ```typescript
  // lib/supabaseClient.ts (standard pattern)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  ```
  With no RLS, the anon key grants full read access to all rows in all tables.
- **Recommendation:** **Immediately verify RLS is enabled on all tables** in the Supabase dashboard. Create RLS policies that filter by `company_id` matching the JWT's `app_metadata.company_id`. This is the single most important security fix. Add RLS policy definitions to version control via Supabase migrations.

### [HIGH] Employee CRUD Operations Rely Solely on Client-Side Authorization
- **File:** `/components/EmployeeDashboard.tsx`, lines for insert/update/delete operations
- **Risk:** Employee management operations (add, edit, delete, merge, batch upload) are performed via direct Supabase client calls. The only authorization check is whether the user is viewing their own company's data (based on the client-side company filter). Without RLS, any authenticated user could insert, update, or delete employee records for any company.
- **Evidence:**
  ```typescript
  // EmployeeDashboard.tsx — delete operation
  const { error } = await supabase
    .from('employee_manager')
    .delete()
    .eq('id', employee!.id);

  // Batch upload — insert
  const { error } = await supabase
    .from('employee_manager')
    .insert(newEmployees);
  ```
  The `company_name` and `company_id` on inserted rows come from client-side state and are not validated server-side.
- **Recommendation:** Enable RLS on `employee_manager` with policies that restrict insert/update/delete to rows matching the user's `company_id` from JWT. Add a server-side trigger or function to validate that `company_id` on inserts matches the authenticated user's company.

### [MEDIUM] Benchmark Data Is Not Company-Scoped
- **File:** `/components/HomeDashboard.tsx` (benchmark fetch)
- **Risk:** Benchmark data from the `boon_benchmarks` table is fetched with only a `program_type` filter, not a company filter. While benchmarks may be intentionally shared across all companies (aggregate industry data), this should be explicitly documented. If company-specific benchmark data is ever added to this table, it would be exposed to all tenants.
- **Evidence:**
  ```typescript
  const { data: benchmarkData } = await supabase
    .from('boon_benchmarks')
    .select('*')
    .eq('program_type', 'GROW');
  ```
- **Recommendation:** Document that `boon_benchmarks` is intentionally a shared/public table. Add a comment in code. If company-specific benchmarks are ever needed, add a `company_id` column with RLS.

### [LOW] Client-Side Cache Could Serve Stale Data After Company Switch
- **File:** `/lib/dataFetcher.ts`, lines 1–30 (cache implementation)
- **Risk:** The in-memory cache uses a 5-minute TTL. If an admin switches companies, cached data from the previous company could theoretically be served if the cache key happens to collide. However, the cache key includes the filter parameters (`JSON.stringify(filter)`), which mitigates this risk in practice. The risk is low but worth noting.
- **Evidence:**
  ```typescript
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const cache = new Map<string, CacheEntry<any>>();

  function getCacheKey(prefix: string, filter?: CompanyFilter): string {
    return `${prefix}:${JSON.stringify(filter || {})}`;
  }
  ```
- **Recommendation:** Clear the cache when an admin switches companies. Add `cache.clear()` to the company-switch handler in `App.tsx`.

---

## Summary of Recommendations (Priority Order)

1. **[CRITICAL] Verify and enforce RLS on ALL Supabase tables** — This is the foundational security control. Without it, every other finding is amplified.
2. **[CRITICAL] Add JWT validation to the AI edge function** — The endpoint is currently open to the internet.
3. **[HIGH] Replace `ilike` partial matching with exact `eq` on `company_id`** — Eliminate the most pervasive cross-tenant leakage vector.
4. **[HIGH] Restrict CORS on edge functions** — Lock down to production origins only.
5. **[HIGH] Add server-side authorization for exports** — Log and validate all data exports.
6. **[HIGH] Add server-side enforcement for admin company switching** — Don't rely on localStorage.
7. **[HIGH] Add RLS-enforced authorization for employee CRUD** — Prevent cross-tenant write operations.
8. **[MEDIUM] Sanitize AI prompt inputs** — Prevent prompt injection via user-controlled data.
9. **[MEDIUM] Centralize all queries through dataFetcher.ts** — Eliminate inconsistent filtering patterns.
10. **[MEDIUM] Add export audit logging** — Track who exports what data and when.
