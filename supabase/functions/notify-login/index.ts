import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_CUSTOMER_PORTAL_NOTIFICATIONS");
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "https://portal.boon-health.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.7");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { company_id, company_name, user_email } = await req.json();

    if (!company_id && !company_name) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SLACK_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Slack not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve account name: use company_id -> program_config if available, else use company_name directly
    let accountName: string | null = null;
    if (company_id) {
      const { data: configRow } = await supabase
        .from("program_config")
        .select("account_name")
        .eq("company_id", company_id)
        .limit(1)
        .single();
      accountName = configRow?.account_name ?? null;
    }
    if (!accountName && company_name) {
      accountName = company_name;
    }

    const { data: companyRow } = accountName ? await supabase
      .from("companies")
      .select("slack_channel_id")
      .eq("name", accountName)
      .single() : { data: null };

    const channelId = companyRow?.slack_channel_id;
    if (!channelId) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageText = `:eyes: *${company_name}* — ${user_email} logged into the portal`;

    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text: messageText,
        unfurl_links: false,
      }),
    });

    const slackData = await slackRes.json();
    if (!slackData.ok) {
      console.error("Slack API error:", slackData.error);
      return new Response(
        JSON.stringify({ error: `Slack error: ${slackData.error}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-login error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
