-- Add slack_channel_id to program_config for internal setup task notifications
-- Set this per company via Supabase dashboard or admin tooling
ALTER TABLE program_config ADD COLUMN IF NOT EXISTS slack_channel_id text;
