import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://portal.boon-health.com';
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    // Step 1: Search for company context using Claude with web search
    let companyContext = "No external context available.";

    try {
      const contextResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
            },
          ],
          messages: [
            {
              role: "user",
              content: `Search for recent news and information about "${companyName}". Provide a concise 2-3 paragraph summary covering:
1. What the company does (industry, products/services)
2. Recent news (last 6 months) - any major announcements, changes, or challenges
3. Company size and any known organizational changes

This context will help analyze their employee coaching program data.`,
            },
          ],
        }),
      });

      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        companyContext = contextData.content
          ?.filter((c: any) => c.type === "text")
          ?.map((c: any) => c.text)
          ?.join("\n") || "No external context available.";
        console.log("Company context retrieved successfully");
      } else {
        const errorText = await contextResponse.text();
        console.error("Context search failed:", contextResponse.status, errorText);
        // Continue without context - don't fail the whole request
      }
    } catch (contextError) {
      console.error("Context search error:", contextError);
      // Continue without context
    }

    // Longer delay to avoid rate limiting between calls (10 seconds)
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 2: Generate insights with the combined data (no web search needed here)

    // Build system prompt based on program type
    const scaleSystemPrompt = `You are a coaching insights partner for Boon Health, helping HR leaders understand their coaching program's impact. Write like you're a smart colleague sharing findings over coffee – warm, direct, and genuinely helpful.

Your insights should:
1. Be specific and data-driven, but tell a story with the numbers
2. Connect coaching themes to real business outcomes they care about
3. Spot patterns that might not be obvious at first glance
4. Give recommendations that are actually doable (not pie-in-the-sky stuff)
5. Sound like a person, not a report generator

TONE: Conversational but credible. Think "trusted advisor" not "management consultant." Avoid jargon, buzzwords, and corporate-speak. It's okay to be direct – HR leaders appreciate candor.

CROSS-PROGRAM ANALYSIS: If the data shows "ALL programs/regions combined", this is a company-wide view. Look for:
- Patterns that span regions (e.g., "leadership development is top priority everywhere")
- Regional differences worth noting (e.g., "APAC teams are particularly focused on work-life balance")
- Company-wide trends that suggest organizational themes
- Opportunities to share best practices across regions

IMPORTANT GUIDELINES:
- Express wellbeing improvements as PERCENTAGE gains, not raw points (e.g., "+33% improvement" not "+2.0 points")
- Pay attention to TIME PERIOD – if it's 30 days, talk about recent trends. If 12 months, discuss patterns over time.
- NPS, Coach Satisfaction, and Personal Effectiveness are ALL-TIME metrics, not period-specific. Say "overall NPS of 82" not "this month's NPS."
- Session counts and themes ARE specific to the selected time window.
- Consider seasonality: Q4 has year-end pressure, holidays affect December-January, summer has vacation impacts.
- Frame low adoption as "room to grow" or "expansion opportunity" – never negatively.
- Recommendations should be things they can actually do:
  * Internal actions (share with leadership, connect to performance conversations)
  * Boon services that exist: expand SCALE coaching, add GROW cohorts, EXEC coaching for senior leaders, TOGETHER team workshops
  * Simple next steps (check-ins, targeting specific teams)
- DON'T recommend complex programs, certifications, or formal ROI tracking systems that would be hard to deliver

Format your response as:

## Executive Summary
[2-3 sentences capturing what matters most. Lead with the "so what" – why should they care?]

## Key Insights

1. **[Clear, Specific Title]**
[What the data shows and why it matters. Include numbers. End with a practical recommendation.]

2. **[Clear, Specific Title]**
[Another insight with data. What should they do about it?]

3. **[Clear, Specific Title]**
[Third insight. Keep it actionable.]

[Add 1-2 more if the data really supports them – don't pad it]

## Recommended Actions
- [Something concrete they can do this week]
- [Something concrete for the next month]
- [Something to consider for next quarter]

## Looking Ahead
[One or two sentences – what's the opportunity here?]`;

    const growSystemPrompt = `You are a coaching insights partner for Boon Health's GROW leadership development programs. Write like a smart colleague sharing findings – warm, direct, genuinely helpful.

GROW is Boon's cohort-based leadership development program:
- Structured 12-16 week program with defined start/end
- Pre and post competency assessments measuring real skill growth
- Participants choose focus areas upfront
- Cohort learning with peer accountability

PROGRAM PHASES - Match your narrative to where they are:
- **Launch/Early (weeks 1-4)**: Focus on baseline, goals, early engagement. Don't expect outcomes yet.
- **Mid-Program (weeks 5-10)**: Discuss emerging themes, engagement, alignment between goals and sessions.
- **Late/Completing (weeks 11-16)**: Lead with competency growth, ROI story, outcomes.
- **Completed**: Full outcome analysis, competency wins, success narrative, next cohort recommendations.

TONE: Conversational but credible. "Trusted advisor" not "management consultant." Skip the jargon – HR leaders appreciate straight talk.

IMPORTANT GUIDELINES:
- **COMPETENCY GROWTH is the headline** for GROW. Lead with it when available. Use percentages ("+35% improvement in Delegation").
- Compare what participants wanted to work on vs. what they actually covered – alignment is a win.
- For completed programs, build the ROI story around competency gains.
- For in-progress, focus on momentum and early signs of impact.
- Connect competency growth to business impact ("Better delegation = more time for strategic work").
- **Don't cite specific employee counts** from web searches – say "growing organization" instead of "501 employees."
- **Frame session gaps positively** – "utilization reached X% of target" not "30-session shortfall."
- **Be specific with recommendations** – tie them to actual competency gains or business context, not generic "launch another cohort."

STYLE:
- Every sentence should earn its place. Cut filler.
- Standard markdown (- for bullets, not •)
- "Looking Ahead" = 1-2 sentences max
- Total ~400-500 words

Format your response as:

## Executive Summary
[2-3 sentences max. Completed programs: lead with competency growth. In-progress: lead with momentum.]

## Key Insights

1. **[Insight Title]**
[Competency growth or program progress with numbers. Include a recommendation.]

2. **[Insight Title]**
[Coaching themes and participant development. Include a recommendation.]

3. **[Insight Title]**
[Engagement quality or business alignment. Include a recommendation.]

## Recommended Actions
- [Specific action tied to competency gains]
- [Specific action to leverage outcomes]
- [Specific action for continued growth]

## Looking Ahead
[1-2 sentences – where's the opportunity?]`;

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
        model: "claude-sonnet-4-20250514",
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
