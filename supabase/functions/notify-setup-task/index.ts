import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN_SETUP_NOTIFICATIONS");
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

    const { company_id, company_name, task_id, task_label, completed_count, total_count } = await req.json();

    if (!company_id || !task_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user belongs to this company (admins can act on any)
    const userCompanyId = user.app_metadata?.company_id;
    const isAdmin = user.app_metadata?.role === "admin";
    if (userCompanyId && userCompanyId !== company_id && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied: company mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SLACK_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Slack not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the Slack channel for this company
    const { data: configRows } = await supabase
      .from("program_config")
      .select("slack_channel_id")
      .eq("company_id", company_id)
      .not("slack_channel_id", "is", null)
      .limit(1);

    const channelId = configRows?.[0]?.slack_channel_id;
    if (!channelId) {
      // No channel configured — silently succeed
      return new Response(
        JSON.stringify({ ok: true, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const progressText = (completed_count != null && total_count != null)
      ? `${completed_count} of ${total_count} tasks complete`
      : null;

    const messageText = [
      `:white_check_mark: *${company_name}* completed a setup task`,
      `*Task:* ${task_label}`,
      progressText ? `*Progress:* ${progressText}` : null,
    ].filter(Boolean).join("\n");

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
    console.error("notify-setup-task error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
