import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

// Resolve CORS origin at request time so prod, the legacy prod host, and
// every Vercel preview URL for this project all work without manual secret
// updates. The previous single-origin ALLOWED_ORIGIN broke every preview
// deploy because the browser rejected the preflight.
const staticAllowedOrigins = new Set<string>([
  "https://insights.boon-health.com",
  "https://portal.boon-health.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);
// Optional override via env; accepts comma-separated list.
const envAllowedOrigins = (Deno.env.get("ALLOWED_ORIGIN") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
for (const o of envAllowedOrigins) staticAllowedOrigins.add(o);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (staticAllowedOrigins.has(origin)) return true;
  // Allow any Vercel preview URL for this project.
  // Vercel preview hostnames look like
  //   boon-customer-portal-2026-<slug>-boon-coaching.vercel.app
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow = isAllowedOrigin(origin) ? origin! : "https://insights.boon-health.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = corsHeadersFor(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client to verify the token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.7');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's company matches the requested company
    const userCompanyId = user.app_metadata?.company_id;

    const { companyName, companyId, internalData, programType, programPhase } = await req.json();

    // Verify company access
    if (companyId && userCompanyId && companyId !== userCompanyId) {
      // Allow admin users to access any company
      const isAdmin = user.app_metadata?.role === 'admin';
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Access denied: company mismatch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const isGrow = programType === 'GROW';
    console.log(`Generating ${isGrow ? 'GROW' : 'SCALE'} insights for ${companyName} (${companyId})${programPhase ? ` - Phase: ${programPhase}` : ''}`);

    // Step 1: Search for company context using Perplexity (purpose-built for
    // research + synthesis of recent news). Falls back gracefully if the key
    // is missing or the call fails: the insight generation still runs.
    let companyContext = "No external context available.";

    if (PERPLEXITY_API_KEY) {
      try {
        const contextResponse = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
          },
          body: JSON.stringify({
            model: "sonar-pro",
            max_tokens: 700,
            messages: [
              {
                role: "system",
                content: "You are a research analyst. Return a concise 2-3 paragraph briefing with no preamble, no headings, and no bullet lists. Prioritize specific facts over general descriptions. Do not use em dashes or en dashes; use commas, periods, or parentheses instead.",
              },
              {
                role: "user",
                content: `Brief me on "${companyName}". Cover:
1. What the company does (industry, products/services)
2. Recent news from the last 6 months: major announcements, leadership changes, layoffs, reorganizations, funding, or challenges
3. Company size and any known organizational changes

This context will help analyze their employee coaching program data.`,
              },
            ],
          }),
        });

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          companyContext = contextData.choices?.[0]?.message?.content || "No external context available.";
          console.log("Company context retrieved via Perplexity");
        } else {
          const errorText = await contextResponse.text();
          console.error("Perplexity context search failed:", contextResponse.status, errorText);
          // Continue without context - don't fail the whole request
        }
      } catch (contextError) {
        console.error("Perplexity context search error:", contextError);
        // Continue without context
      }
    } else {
      console.warn("PERPLEXITY_API_KEY not set, skipping company context step");
    }

    // Step 2: Generate insights with the combined data (no web search needed here)

    // ==============================================================
    // Shared insight-quality rules used by both Grow and Scale prompts.
    // The failure mode we're fighting: Opus defaulting to narration
    // ("an NPS of 83 tells us participants valued the experience") when
    // the reader can already see the number. Every sentence must earn
    // its place by adding interpretation the data alone doesn't give.
    // ==============================================================
    const sharedInsightRules = `# Your job
You are writing a briefing for an HR or L&D leader who already has the dashboard open next to this report. They can see every number. Your job is NOT to narrate what they see. It is to interpret it in a way that changes what they do next.

# The four-way test
Every observation you make must do at least ONE of these four things. If it doesn't, cut it.

1. **Name a tension.** Two signals that don't obviously fit together. Example: "NPS is 83, but only 4 of 26 participants completed pre/post assessments. That gap tells me the experience landed, but the measurement wasn't built into the program milestones."

2. **Compare to a benchmark.** Against the Boon average, against this company's prior cohort, against the participant's own baseline, against industry norms. Raw numbers without a reference point are narration.

3. **Find what's missing.** Absence can be louder than presence. If session themes are 58% career development and 0% delegation, the absence is the story. Name it.

4. **Connect to company-specific context.** Use the external research provided. Not as decoration ("in a vertically integrated business" as a label), but as mechanism. Example: "The Wonderful Company reorganized consumer brands under one P&L in Q3. The +8% gain in Conflict Resolution probably isn't random. It's leaders learning to navigate newly merged teams."

If you can't do one of these four with the data you have, say so honestly. "With only 4 pre/post pairs we can't claim a cohort-level pattern. Here's what we can say."

# Hard rules

- **Do not restate a number the reader can see in the dashboard**, unless you're immediately comparing it to something else.
- **No em dashes or en dashes.** Use commas, periods, or parentheses. The long dash is banned, no exceptions.
- **Banned phrases** (placeholder language that signals generic output): "hungry for growth," "retention lever," "room to grow," "soft wins," "trusted advisor," "drive performance," "unlock potential," "learning journey," "pie in the sky," "waiting to be pulled," "clearly," "meaningful gains," "strong engagement signals." If you catch yourself writing these, rewrite.
- **First mention of the company uses the full name.** "The Wonderful Company" before "TWC." Same for products (Grow, Scale, Exec, Together): full name first.
- **Every recommendation must be specific enough that a competitor couldn't say the same thing.** "Launch a roundtable" is generic. "Host a 60-minute roundtable with the four participants who completed assessments, aimed at capturing how Conflict Resolution gains showed up in specific cross-functional moments" is specific.
- **Numbers use whole percentages** ("+8%") unless the decimal carries meaning. No 16-decimal floats.
- **Cite coach satisfaction out of 10** ("9.3/10"), NPS as a signed integer ("+33").
- **Never invent data.** If something isn't in the provided data or research, don't claim it.

# Voice (Boon)

- Warm but not soft. Direct. Confident without overreaching.
- Sound like a smart colleague, not a report generator. A real person wrote this, about a real cohort, for a real leader.
- Cut filler. Every sentence earns its place.
- Words that say "I care" more than "I'm impressed": specific > generic.

# Format

No rigid scaffolding. Use the structure the material calls for. A good insight brief for THIS cohort at THIS moment might be 3 short paragraphs. Another might be a one-line opening plus two deep observations plus two recommendations. Let the story dictate the shape.

What every brief should have, in some form:
- A single-sentence opening that states the most important thing to know. Not a summary. A conclusion.
- 2 to 4 observations, each passing the four-way test above.
- Recommendations that follow from the observations, not a generic action list. Tie each recommendation to a specific observation.
- An honest caveat about what the data can and can't tell us (where relevant).

Do not use these section headers: "Executive Summary," "Key Insights," "Recommended Actions," "Looking Ahead." They signal corporate report and invite generic prose. Use whatever headers the material actually deserves, or none.`;

    const scaleSystemPrompt = `${sharedInsightRules}

# Context for this report: Scale (always-on coaching)

Scale is Boon's always-on 1:1 coaching product for every employee, not just executives. The promise is "visibility without surveillance." HR/L&D sponsors get program-level adoption, themes, and satisfaction data, but individual sessions stay confidential.

- You will NOT receive or surface anything about individual participants. Every observation must be cohort-level aggregate.
- Never use language that implies individual tracking: no "top users," no "who's using coaching," no "most active people."
- Frame low adoption as a targeting or awareness problem, not a people problem.
- Satisfaction and NPS are all-time metrics. Session counts and themes are time-window specific.
- If data spans multiple programs or regions, look for cross-program patterns and regional differences worth naming.

# What "good" looks like for Scale

A senior L&D leader reads your brief and thinks: "Someone who understands my business wrote this, and they saw something I hadn't noticed." They should walk away with one thing they didn't already know, and one thing to do about it this week.`;

    const growSystemPrompt = `${sharedInsightRules}

# Context for this report: Grow (cohort leadership development)

Grow is Boon's cohort-based leadership development program. Structured 12 to 16 weeks, pre and post competency assessments, participants choose focus areas upfront, cohort-based peer learning. Unlike Scale, Grow participants are named in the HR sponsor's roster, and cohort-level outcomes are the expected reporting surface.

Program phases. Match your framing to where they are:
- **Launch or Early (weeks 1 to 4):** baseline collection, goal setting. Don't claim outcomes that don't exist yet.
- **Mid-program (weeks 5 to 10):** themes emerging, engagement quality, alignment between stated focus areas and what they actually worked on.
- **Late or Completing (weeks 11 to 16):** competency growth is the headline. Lead with it.
- **Completed:** full outcome analysis. Competency wins are the story. Build toward "what makes the next cohort better."

# What "good" looks like for Grow

For completed programs, lead with the competency gain that moved most and tell the reader what it means for the business. Tie the gain to the external company context when possible. A +8% Conflict Resolution gain after a reorg is a different story than the same gain in a steady-state year.

For in-progress programs, lead with momentum or with a specific tension (stated focus areas vs. actual session themes is usually rich).

For this particular program, the single most valuable thing you can do is compare what participants SAID they wanted to work on (focus areas) to what they ACTUALLY worked on (session themes). Alignment is a win worth naming. Divergence is an even better story. It tells the sponsor something about how their people actually develop.

A head of L&D reads your brief and thinks: "I can walk into the exec meeting with this and have a real conversation about what this cohort produced."`;

    const systemPrompt = isGrow ? growSystemPrompt : scaleSystemPrompt;

    // Helper function to make API call with retry on 429
    const callWithRetry = async (url: string, options: RequestInit, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);

        if (response.status === 429) {
          if (attempt === maxRetries) {
            throw new Error(`Rate limited after ${maxRetries} attempts`);
          }
          // Exponential backoff: 15s, 30s, 60s
          const waitTime = 15000 * Math.pow(2, attempt - 1);
          console.log(`Rate limited (429), waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        return response;
      }
      throw new Error("Max retries exceeded");
    };

    const insightsResponse = await callWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Analyze this coaching program data and share your insights.

## Internal Coaching Data
${internalData}

## External Company Context
${companyContext}

Connect the coaching patterns to business context and give ${companyName}'s team specific, actionable recommendations.`,
          },
        ],
      }),
    });

    if (!insightsResponse.ok) {
      const errorText = await insightsResponse.text();
      console.error("Insights generation error:", insightsResponse.status, errorText);
      throw new Error(`Failed to generate insights: ${insightsResponse.status}`);
    }

    const insightsData = await insightsResponse.json();
    const insights = insightsData.content
      ?.filter((c: any) => c.type === "text")
      ?.map((c: any) => c.text)
      ?.join("\n") || "Unable to generate insights.";

    console.log(`Successfully generated insights for ${companyName}`);

    return new Response(
      JSON.stringify({
        success: true,
        insights,
        companyContext,
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in ai-generate-insights:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        insights: null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
