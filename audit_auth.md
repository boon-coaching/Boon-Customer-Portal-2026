# Authentication & Session Security Audit

**Auditor:** Agent 3 - Auth & Session Security
**Date:** 2026-02-08
**Scope:** Authentication flows, session management, RBAC, credentials, route protection, client-side security
**Application:** Boon Customer Portal (React SPA + Supabase + Vercel)

---

## Executive Summary

The portal has **critical credential exposure** (hardcoded Supabase anon key in source code and a mismatched Supabase URL in a utility script), an **easily spoofable admin role check** based solely on client-side email domain matching with no server-side enforcement, **no rate limiting** on authentication attempts, and **weak password policy** (6-character minimum). The admin company-switching feature stores overrides in localStorage with no server-side validation, meaning any user who can set `isAdmin = true` in client state can impersonate admin access across all tenants. These findings collectively represent a high-risk attack surface for a multi-tenant SaaS application handling sensitive employee coaching data.

**Critical Findings:** 4
**High Findings:** 5
**Medium Findings:** 7
**Low Findings:** 4
**Informational:** 3

---

## A) Authentication Flow

### [CRITICAL] A-1: Hardcoded Supabase Anon Key in Frontend Source Code
- **File:** `/lib/supabaseClient.ts:5-6`
- **Risk:** The Supabase URL and anon key are hardcoded as fallback values directly in the source code. These are baked into the JavaScript bundle shipped to every browser. While anon keys are designed to be public, this particular pattern (`|| 'hardcoded_value'`) means the key is always available even if environment variables are properly configured, and it cannot be rotated without a code deployment.
- **Evidence:**
  ```typescript
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nbwwqreqmxakevkwzmij.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3dxcmVxbXhha2V2a3d6bWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTY2OTUsImV4cCI6MjA4MDk5MjY5NX0.Xd0bdoQHW9oJC7kLevjB5Wh0hYOpRKVPjIq8';
  ```
- **Recommendation:** Remove hardcoded fallback values. Use only `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` without fallbacks. The build should fail if these are not set. Ensure the anon key is properly scoped with Row Level Security (RLS) policies on all tables.

### [HIGH] A-2: No Rate Limiting on Login Attempts
- **File:** `/components/LoginPage.tsx:37-61`
- **Risk:** The login handler (`handleLogin`) makes direct calls to `supabase.auth.signInWithPassword()` with no client-side rate limiting, lockout mechanism, or CAPTCHA. While Supabase has built-in rate limiting at the GoTrue level, the application adds no additional protection. An attacker can script unlimited login attempts for credential stuffing or brute-force attacks.
- **Evidence:**
  ```typescript
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      // No attempt counter, no lockout, no CAPTCHA
  ```
- **Recommendation:** Implement client-side rate limiting (e.g., exponential backoff after 3 failed attempts). Add CAPTCHA (reCAPTCHA or hCaptcha) after repeated failures. Configure Supabase Auth rate limiting appropriately in the Supabase dashboard. Consider account lockout after N failed attempts.

### [HIGH] A-3: Weak Password Policy (6-Character Minimum)
- **File:** `/components/LoginPage.tsx:74-78`, `/components/ResetPasswordPage.tsx:34-38`
- **Risk:** The minimum password length is only 6 characters with no complexity requirements (no uppercase, lowercase, numbers, or special characters required). This makes accounts vulnerable to brute-force and dictionary attacks.
- **Evidence:**
  ```typescript
  if (password.length < 6) {
    setError('Password must be at least 6 characters');
    setLoading(false);
    return;
  }
  ```
- **Recommendation:** Enforce minimum 12-character passwords. Require mixed case, numbers, and special characters. Consider integrating with Have I Been Pwned (HIBP) API to reject known-compromised passwords. Also enforce this server-side in Supabase Auth configuration.

### [MEDIUM] A-4: No Rate Limiting on Password Reset
- **File:** `/components/LoginPage.tsx:111-131`
- **Risk:** The forgot-password handler sends reset emails without any rate limiting or abuse prevention. An attacker can enumerate valid emails (different error messages for valid vs invalid emails) and flood a user's inbox with reset emails.
- **Evidence:**
  ```typescript
  const handleForgotPassword = async (e: React.FormEvent) => {
    // No rate limiting, no CAPTCHA
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  ```
- **Recommendation:** Implement rate limiting (1 reset request per email per 60 seconds). Add CAPTCHA. Return a generic success message regardless of whether the email exists to prevent enumeration.

### [MEDIUM] A-5: Open Self-Registration Enabled
- **File:** `/components/LoginPage.tsx:63-109`
- **Risk:** The sign-up form allows anyone to create an account. For a B2B multi-tenant SaaS application serving enterprise coaching clients, open registration means unauthorized users can create accounts. While they may not have `company` or `program_type` in their metadata, they will have an authenticated session that interacts with the Supabase API.
- **Evidence:**
  ```typescript
  const handleSignUp = async (e: React.FormEvent) => {
    // Anyone can sign up with any email
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });
  ```
- **Recommendation:** Disable open self-registration or restrict it to pre-approved email domains. Implement invite-only registration where admins provision accounts for their company's employees. At minimum, require email verification before granting any data access.

### [LOW] A-6: Verbose Error Messages Expose Auth Details
- **File:** `/components/LoginPage.tsx:56-58`
- **Risk:** Supabase error messages are passed directly to the user. Messages like "Invalid login credentials" vs "User not found" can help attackers enumerate valid accounts.
- **Evidence:**
  ```typescript
  } catch (err: any) {
    setError(err.message || 'Failed to sign in');
  }
  ```
- **Recommendation:** Map all auth errors to a generic message: "Invalid email or password. Please try again." Do not reveal whether the email exists in the system.

---

## B) Session Management

### [MEDIUM] B-1: Session Tokens Stored in localStorage (Supabase Default)
- **File:** `/lib/supabaseClient.ts:13-19`
- **Risk:** The Supabase client is initialized with default storage settings, which means auth tokens (JWT access tokens and refresh tokens) are stored in `localStorage`. This makes them accessible to any JavaScript running on the page, including XSS payloads and malicious browser extensions. Since the app loads external scripts from CDNs (Tailwind, ESM.sh), a compromised CDN could exfiltrate tokens.
- **Evidence:**
  ```typescript
  export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'public' },
    global: { headers: { 'x-my-custom-header': 'boon-dashboard' } },
    // No auth.storage override - defaults to localStorage
  });
  ```
- **Recommendation:** For a production security-sensitive application, configure Supabase to use server-side session management or at minimum set `auth.flowType: 'pkce'` and explore httpOnly cookie-based session storage via a backend proxy.

### [MEDIUM] B-2: No Explicit Session Expiry Configuration
- **File:** `/lib/supabaseClient.ts`, `/components/ProtectedRoute.tsx`
- **Risk:** There is no custom session timeout configuration. Session expiry relies entirely on Supabase defaults (default JWT expiry of 1 hour with auto-refresh). There is no idle timeout, no absolute session lifetime limit, and no forced re-authentication for sensitive operations.
- **Evidence:** The Supabase client is created with no `auth.persistSession`, `auth.detectSessionInUrl`, or session timeout overrides. ProtectedRoute checks `getSession()` but does not verify token freshness.
- **Recommendation:** Configure appropriate session timeouts. Implement idle timeout (e.g., 30 minutes of inactivity). Add absolute session lifetime (e.g., 8 hours). Require re-authentication for sensitive admin operations like company switching.

### [INFO] B-3: Auth State Change Listener Properly Implemented
- **File:** `/components/ProtectedRoute.tsx:35-40`
- **Risk:** N/A (Positive finding)
- **Evidence:** The ProtectedRoute correctly subscribes to `onAuthStateChange` and properly cleans up the subscription on unmount. This ensures session state is kept in sync.
  ```typescript
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (mounted) {
      setSession(session);
      setLoading(false);
    }
  });
  ```
- **Recommendation:** No action needed. This is correctly implemented.

---

## C) Role-Based Access Control

### [CRITICAL] C-1: Admin Role Determined Solely by Client-Side Email Domain Check
- **File:** `/constants.ts:4-8`, `/App.tsx:310-311`
- **Risk:** Admin status is determined entirely on the client side by checking if the user's email ends with `@boon-health.com`. There is no server-side role verification, no JWT claim for admin role, and no RLS policy that validates admin status. This means: (1) Anyone who registers with an `@boon-health.com` email gains admin access to ALL company data via the company switcher. (2) Since email verification may not be enforced immediately, a temporary admin session could be obtained. (3) There are no Supabase RLS policies that distinguish admin from regular users.
- **Evidence:**
  ```typescript
  // constants.ts
  export const isAdminEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return email.toLowerCase().endsWith('@boon-health.com');
  };

  // App.tsx
  const adminUser = isAdminEmail(email);
  setIsAdmin(adminUser);
  ```
- **Recommendation:** Move admin role to Supabase `app_metadata.role` (set via server-side admin API only, not modifiable by users). Implement RLS policies that check `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` for admin-only operations. Remove the email domain check from client code. Add a server-side middleware or edge function to validate admin status on sensitive operations.

### [CRITICAL] C-2: Admin Company Switcher Has No Server-Side Validation
- **File:** `/App.tsx:62-257`, `/App.tsx:326-347`
- **Risk:** The admin company switcher fetches ALL companies from `session_tracking` and `program_config` tables, then stores the selected company override in `localStorage`. The data filtering throughout the entire application is then based on this localStorage value. There is zero server-side validation that the user should have access to the selected company's data. If an attacker manipulates the `isAdmin` check (or if RLS policies are permissive), they can browse any company's data by setting `localStorage.setItem('boon_admin_company_override', ...)`.
- **Evidence:**
  ```typescript
  // Fetches ALL session_tracking records to build company list
  const { data, error } = await supabase
    .from('session_tracking')
    .select('account_name, program_title, company_id')
    .order('account_name')
    .range(from, from + pageSize - 1);

  // Stores override in localStorage
  const handleSelect = (company: CompanyOverride) => {
    localStorage.setItem(ADMIN_COMPANY_KEY, JSON.stringify(company));
    onCompanyChange(company.account_name, company.programType, company.hasBothTypes);
  };
  ```
- **Recommendation:** Implement server-side authorization for cross-company data access. Add RLS policies that restrict data visibility based on `auth.jwt() -> 'app_metadata' ->> 'company_id'` for regular users. For admin users, validate the admin role in RLS policies using `auth.jwt() -> 'app_metadata' ->> 'role'`. Never trust client-side localStorage for authorization decisions.

### [HIGH] C-3: Every Dashboard Component Independently Checks Admin Status Client-Side
- **File:** Multiple components (see evidence)
- **Risk:** Every dashboard component (`HomeDashboard`, `SessionDashboard`, `EmployeeDashboard`, `ImpactDashboard`, `ThemesDashboard`, `BaselineDashboard`, `ScaleDashboard`, `ScaleBaselineDashboard`, `SetupDashboard`, `FeedbackDashboard`, `ReportGenerator`) independently calls `isAdminEmail()` and reads from `localStorage` to determine company context. This duplicated pattern means: (1) A bug in any single component could expose cross-tenant data. (2) The admin check can be bypassed by manipulating browser state. (3) There is no centralized authorization layer.
- **Evidence:** Pattern repeated across 12+ components:
  ```typescript
  const isAdmin = isAdminEmail(email);
  if (isAdmin) {
    const stored = localStorage.getItem('boon_admin_company_override');
    if (stored) {
      const override = JSON.parse(stored);
      // Use override to fetch any company's data
    }
  }
  ```
- **Recommendation:** Centralize authorization in a context provider. Move all authorization decisions to the server (RLS policies + edge functions). The client should only render what the server returns, not make authorization decisions itself.

### [HIGH] C-4: No Server-Side Role Enforcement -- URL Manipulation Can Reach Any Route
- **File:** `/App.tsx:778-800`
- **Risk:** All routes within `MainPortalLayout` are accessible to any authenticated user. While the sidebar conditionally hides certain nav items based on `isScale` or `isAdmin`, the actual route definitions do not enforce any role-based access. An authenticated user can navigate directly to `/setup`, `/sessions`, `/impact`, `/employees`, `/baseline`, or any other route regardless of their program type or admin status.
- **Evidence:**
  ```typescript
  <Routes>
    <Route path="/setup" element={<SetupDashboard />} />
    <Route path="/" element={isScale ? <ScaleDashboard .../> : <HomeDashboard .../> } />
    <Route path="/sessions" element={<SessionDashboard ... />} />
    <Route path="/employees" element={<EmployeeDashboard />} />
    <Route path="/impact" element={<ImpactDashboard ... />} />
    <Route path="/themes" element={<ThemesDashboard ... />} />
    <Route path="/baseline" element={...} />
    {/* No role-based route guards */}
  </Routes>
  ```
- **Recommendation:** Implement route-level authorization guards. Create an `AdminRoute` wrapper that validates admin status server-side. Ensure program type restrictions are enforced in RLS policies so that even if a Scale user navigates to `/sessions`, the server returns no data.

### [MEDIUM] C-5: Manager Role Check Via Database Query Without Authorization
- **File:** `/App.tsx:313-321`
- **Risk:** Manager status is determined by querying the `employee_manager` table for records matching the current user's email. If RLS is not properly configured on this table, any authenticated user could potentially see manager data. Additionally, the manager check only looks for any matching row, not for specific authorized relationships.
- **Evidence:**
  ```typescript
  const { data: managerCheck } = await supabase
    .from('employee_manager')
    .select('id')
    .eq('manager_email', email)
    .limit(1);
  const isManagerUser = managerCheck && managerCheck.length > 0;
  ```
- **Recommendation:** Ensure `employee_manager` table has proper RLS policies. Consider moving the manager role to JWT `app_metadata` for consistency with the authorization model.

---

## D) Credentials & Secrets

### [CRITICAL] D-1: Hardcoded Supabase Credentials in Source Code
- **File:** `/lib/supabaseClient.ts:5-6`
- **Risk:** The Supabase URL and full anon JWT token are hardcoded in source code that is committed to the git repository and shipped to every browser. The JWT decodes to: `{"iss":"supabase","ref":"nbwwqreqmxakevkwzmij","role":"anon","iat":1765416695,"exp":2080992695}`. The token does not expire until 2035. If this key needs to be rotated, a code change and redeployment is required.
- **Evidence:** See A-1 above.
- **Recommendation:** Remove hardcoded credentials from source code. Use only environment variables. Add `.env` to `.gitignore`. Rotate the anon key if it has been committed to a public repository.

### [HIGH] D-2: Mismatched Supabase URL in Utility Script Indicates Multiple Environments
- **File:** `/scripts/update-user-metadata.js:2`
- **Risk:** The utility script references a **different** Supabase project URL (`jbmhvqbwfhvldrfgjqjp.supabase.co`) than the main application (`nbwwqreqmxakevkwzmij.supabase.co`). This may indicate: (1) A development vs production environment mismatch. (2) The script may have been accidentally committed from a different environment. (3) The service role key pattern (`process.env.SUPABASE_SERVICE_ROLE_KEY`) is correctly loaded from env vars, but the hardcoded URL is a risk if someone runs this script in the wrong environment.
- **Evidence:**
  ```javascript
  // update-user-metadata.js uses:
  const supabaseUrl = 'https://jbmhvqbwfhvldrfgjqjp.supabase.co';
  // Main app uses:
  const supabaseUrl = '...nbwwqreqmxakevkwzmij.supabase.co';
  ```
- **Recommendation:** Use environment variables for the Supabase URL in the utility script. Document which Supabase project is production vs development. Remove hardcoded URLs.

### [MEDIUM] D-3: Gemini API Key Exposed via Vite Define
- **File:** `/vite.config.ts:13-15`
- **Risk:** The Vite config injects `GEMINI_API_KEY` into the client-side bundle via `define`. This means the API key will be embedded in the compiled JavaScript accessible to any user inspecting the page source or network requests.
- **Evidence:**
  ```typescript
  define: {
    'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  },
  ```
- **Recommendation:** Never expose API keys in client-side bundles. Move Gemini API calls to a Supabase Edge Function or backend proxy. The key should only be accessible server-side.

### [MEDIUM] D-4: Sentry DSN Hardcoded in Source
- **File:** `/App.tsx:41`
- **Risk:** The Sentry DSN is hardcoded in the source. While Sentry DSNs are designed to be public (client-side), a hardcoded DSN enables anyone to send events to your Sentry project, potentially polluting error tracking data or consuming your Sentry quota.
- **Evidence:**
  ```typescript
  Sentry.init({
    dsn: "https://294c2316c823a2c471d7af41681f837c@o4510574332215296.ingest.us.sentry.io/4510574369112064",
  ```
- **Recommendation:** Move DSN to environment variable (`VITE_SENTRY_DSN`). Configure Sentry's allowed origins to restrict which domains can send events.

### [LOW] D-5: Debug Logging Exposes Configuration State
- **File:** `/lib/supabaseClient.ts:9-10`
- **Risk:** Console logging reveals whether Supabase URL and key are configured. While this only shows "SET" or "MISSING" (not the actual values), it leaks configuration information to browser DevTools.
- **Evidence:**
  ```typescript
  console.log('Supabase URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('Supabase Key:', supabaseAnonKey ? 'SET' : 'MISSING');
  ```
- **Recommendation:** Remove debug logging in production. Use conditional logging: `if (import.meta.env.DEV)`.

### [INFO] D-6: .env.example Contains Placeholder Key (Not Real)
- **File:** `/.env.example:3`
- **Risk:** The `.env.example` file contains what appears to be a placeholder/dummy anon key (`sb_publishable__t4Y4wKd59G-FyPOkfwM-w_ZsVbEHUw`), not the actual JWT token found in `supabaseClient.ts`. This is acceptable for an example file.
- **Evidence:** The key in `.env.example` does not match the hardcoded key in `supabaseClient.ts`.
- **Recommendation:** Ensure `.env.example` only contains dummy/placeholder values. Verify `.env` and `.env.local` are in `.gitignore`.

---

## E) Route Protection

### [MEDIUM] E-1: ResetPasswordPage Accessible Without Full Authentication
- **File:** `/App.tsx:833-834`, `/components/ResetPasswordPage.tsx`
- **Risk:** The `/reset-password` route is outside the `ProtectedRoute` wrapper, which is by design for password recovery. However, the page relies on a URL hash fragment (`type=recovery`) to show the password form. An attacker who obtains a valid recovery token from the URL hash can reset the user's password. The page does not validate the token's validity before showing the form -- it only checks if `type=recovery` is present in the hash, not whether the token is valid.
- **Evidence:**
  ```typescript
  // ResetPasswordPage.tsx
  const hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    setHashPresent(true);  // Just checks substring, not token validity
  }
  ```
- **Recommendation:** Validate the recovery token server-side before showing the password form. Show a generic "processing" state until token validation completes. Implement token expiry validation.

### [LOW] E-2: Deep-Link Protection Correctly Preserves Location
- **File:** `/components/ProtectedRoute.tsx:68-71`
- **Risk:** N/A (Positive finding)
- **Evidence:** When redirecting unauthenticated users to login, the current location is preserved:
  ```typescript
  return <Navigate to="/login" state={{ from: location }} replace />;
  ```
  However, the LoginPage does not actually use this saved location to redirect back after login (it always navigates to `/`), which is a minor UX gap but not a security issue.
- **Recommendation:** Consider implementing post-login redirect to the originally requested page, but validate the redirect URL to prevent open redirect attacks.

### [LOW] E-3: Recovery Link Handling in ProtectedRoute
- **File:** `/components/ProtectedRoute.tsx:48-55`
- **Risk:** ProtectedRoute checks for recovery links in the URL hash and redirects to `/reset-password`. The hash fragment is passed directly to the Navigate component. While React Router sanitizes this, the pattern of passing URL fragments between routes should be reviewed.
- **Evidence:**
  ```typescript
  const hash = window.location.hash;
  const isRecoveryLink = hash && hash.includes('type=recovery');
  if (isRecoveryLink) {
    return <Navigate to={`/reset-password${hash}`} replace />;
  }
  ```
- **Recommendation:** Validate that the hash only contains expected Supabase auth parameters before passing it through.

---

## F) Client-Side Security

### [HIGH] F-1: External CDN Dependencies Create Supply Chain Risk
- **File:** `/index.html:8, 36-52`
- **Risk:** The application loads critical dependencies from external CDNs (Tailwind CSS from `cdn.tailwindcss.com`, React and all major libraries from `esm.sh`). A compromise of these CDNs would allow arbitrary JavaScript execution in the context of the application, with access to all user data, authentication tokens in localStorage, and Supabase API access.
- **Evidence:**
  ```html
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.2.0",
      "react-dom": "https://esm.sh/react-dom@18.2.0",
      "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.39.7",
      "@sentry/react": "https://esm.sh/@sentry/react@^10.32.1",
      // ...
    }
  }
  </script>
  ```
- **Recommendation:** Bundle dependencies locally using Vite's build system instead of loading from CDNs. If CDNs must be used, add Subresource Integrity (SRI) hashes to all script tags. Implement Content Security Policy (CSP) headers to restrict script sources.

### [MEDIUM] F-2: No Content Security Policy (CSP) Headers
- **File:** `/index.html`
- **Risk:** There are no CSP headers or meta tags configured. This means the browser will not restrict script sources, style sources, or other resource loading. Combined with the CDN usage, this maximizes the attack surface for XSS and code injection.
- **Evidence:** No `<meta http-equiv="Content-Security-Policy">` tag in `index.html`. No CSP configuration in Vite config. Vercel deployment configuration not reviewed but likely absent.
- **Recommendation:** Implement a strict CSP. At minimum:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://esm.sh; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://res.cloudinary.com https://picsum.photos data:; connect-src 'self' https://*.supabase.co https://*.sentry.io;
  ```
  Add this via Vercel's `headers` configuration in `vercel.json`.

### [INFO] F-3: No dangerouslySetInnerHTML Usage Found
- **Risk:** N/A (Positive finding)
- **Evidence:** A search for `dangerouslySetInnerHTML` across the entire codebase returned zero results. React's default JSX escaping protects against most XSS vectors.
- **Recommendation:** No action needed. Continue avoiding `dangerouslySetInnerHTML`.

### [LOW] F-4: CORS Wildcard on Edge Function
- **File:** `/supabase/functions/ai-generate-insights/index.ts:6-8`
- **Risk:** The Supabase Edge Function uses `Access-Control-Allow-Origin: "*"`, allowing any origin to call the function. While the function likely requires an auth header, the wildcard CORS is overly permissive.
- **Evidence:**
  ```typescript
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  ```
- **Recommendation:** Restrict the allowed origin to the production domain (e.g., `https://portal.boon-health.com`).

---

## Additional Findings

### [MEDIUM] G-1: User PII Sent to Sentry Without Consent
- **File:** `/App.tsx:353-358`
- **Risk:** User email addresses and IDs are sent to Sentry for error tracking without explicit user consent. Depending on jurisdiction (GDPR, CCPA), this may violate privacy requirements.
- **Evidence:**
  ```typescript
  Sentry.setUser({
    id: session.user.id,
    email: session.user.email,
  });
  Sentry.setTag('company', company);
  ```
- **Recommendation:** Review privacy policy and data processing agreements. Consider using only anonymized user IDs for error tracking. Implement consent mechanism for analytics/error tracking.

### [MEDIUM] G-2: Admin Utility Script Contains Specific User Email
- **File:** `/scripts/update-user-metadata.js:8`
- **Risk:** The utility script contains a specific user's email address hardcoded in source code committed to the repository. This leaks PII and internal user information.
- **Evidence:**
  ```javascript
  const user = users.find(u => u.email === 'jay.kantar@mediaartslab.com');
  ```
- **Recommendation:** Remove PII from committed code. Use command-line arguments or environment variables for user-specific operations. Add scripts directory to `.gitignore` or use a separate ops repository.

### [INFO] G-3: Google OAuth Redirect URL Uses window.location.origin
- **File:** `/components/LoginPage.tsx:138-143`
- **Risk:** The OAuth redirect URL is dynamically constructed from `window.location.origin`. While this is a common pattern, if the Supabase project's allowed redirect URLs are not properly configured, this could potentially be exploited in an open redirect scenario.
- **Evidence:**
  ```typescript
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  ```
- **Recommendation:** Verify that Supabase Auth only allows redirect URLs matching the production domain. Hardcode the redirect URL for production builds rather than deriving it from `window.location.origin`.

---

## Summary of Findings by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 4 | A-1, C-1, C-2, D-1 |
| HIGH | 5 | A-2, A-3, C-3, C-4, F-1 |
| MEDIUM | 7 | A-4, A-5, B-1, B-2, D-3, D-4, F-2, C-5, G-1, G-2 |
| LOW | 4 | A-6, D-5, E-2, E-3, F-4 |
| INFO | 3 | B-3, D-6, F-3, G-3 |

## Priority Remediation Order

1. **Immediate (Week 1):** Fix C-1 and C-2 -- Move admin role to server-side JWT claims and enforce via RLS. This is the most exploitable vulnerability.
2. **Immediate (Week 1):** Fix D-1/A-1 -- Remove hardcoded credentials from source code and rotate keys.
3. **Short-term (Week 2):** Fix D-3 -- Move Gemini API key to server-side.
4. **Short-term (Week 2):** Fix A-2/A-3 -- Add rate limiting and strengthen password policy.
5. **Short-term (Weeks 2-3):** Fix F-1/F-2 -- Bundle dependencies locally and implement CSP headers.
6. **Medium-term (Month 1):** Fix C-3/C-4 -- Centralize authorization and add route-level guards.
7. **Medium-term (Month 1):** Fix A-5 -- Restrict self-registration.
8. **Ongoing:** Address remaining MEDIUM/LOW findings.
