-- Portal Events Table and Admin Views
-- Run this in Supabase SQL Editor to set up portal tracking

-- =============================================
-- TABLE: portal_events (core tracking table)
-- =============================================
CREATE TABLE IF NOT EXISTS portal_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  page_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_portal_events_created_at ON portal_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_events_client_id ON portal_events(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_events_user_id ON portal_events(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_events_event_name ON portal_events(event_name);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE portal_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own events
DROP POLICY IF EXISTS "Users can insert their own events" ON portal_events;
CREATE POLICY "Users can insert their own events"
  ON portal_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow service role full access for admin queries
DROP POLICY IF EXISTS "Service role has full access" ON portal_events;
CREATE POLICY "Service role has full access"
  ON portal_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- VIEW: Recent activity by client (last 30 days)
-- =============================================
DROP VIEW IF EXISTS portal_activity_by_client;
CREATE VIEW portal_activity_by_client AS
SELECT
  pc.account_name as client_name,
  pe.client_id,
  COUNT(DISTINCT pe.user_id) as unique_users,
  COUNT(*) as total_events,
  COUNT(CASE WHEN pe.event_name = 'login' THEN 1 END) as logins,
  COUNT(CASE WHEN pe.event_name = 'dashboard_viewed' THEN 1 END) as dashboard_views,
  COUNT(CASE WHEN pe.event_name = 'report_viewed' THEN 1 END) as report_views,
  COUNT(CASE WHEN pe.event_name = 'report_downloaded' THEN 1 END) as downloads,
  MAX(pe.created_at) as last_active
FROM portal_events pe
LEFT JOIN (
  SELECT DISTINCT company_id, account_name FROM program_config
) pc ON pe.client_id = pc.company_id
WHERE pe.created_at > NOW() - INTERVAL '30 days'
GROUP BY pc.account_name, pe.client_id
ORDER BY last_active DESC;

-- =============================================
-- VIEW: Recent activity by user (last 30 days)
-- =============================================
DROP VIEW IF EXISTS portal_activity_by_user;
CREATE VIEW portal_activity_by_user AS
SELECT
  u.email,
  pc.account_name as client_name,
  COUNT(*) as total_events,
  COUNT(CASE WHEN pe.event_name = 'login' THEN 1 END) as logins,
  COUNT(CASE WHEN pe.event_name = 'report_viewed' THEN 1 END) as report_views,
  COUNT(CASE WHEN pe.event_name = 'report_downloaded' THEN 1 END) as downloads,
  MAX(pe.created_at) as last_active
FROM portal_events pe
LEFT JOIN auth.users u ON pe.user_id = u.id
LEFT JOIN (
  SELECT DISTINCT company_id, account_name FROM program_config
) pc ON pe.client_id = pc.company_id
WHERE pe.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.email, pc.account_name
ORDER BY last_active DESC;

-- =============================================
-- VIEW: Event breakdown (last 30 days)
-- =============================================
DROP VIEW IF EXISTS portal_event_summary;
CREATE VIEW portal_event_summary AS
SELECT
  event_name,
  properties->>'report_type' as report_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT client_id) as unique_clients
FROM portal_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY event_name, properties->>'report_type'
ORDER BY count DESC;

-- =============================================
-- QUICK QUERIES (run manually as needed)
-- =============================================

-- Last 50 events
-- SELECT pe.*, u.email, pc.account_name as client_name
-- FROM portal_events pe
-- LEFT JOIN auth.users u ON pe.user_id = u.id
-- LEFT JOIN (SELECT DISTINCT company_id, account_name FROM program_config) pc ON pe.client_id = pc.company_id
-- ORDER BY pe.created_at DESC
-- LIMIT 50;

-- Most active users (last 7 days)
-- SELECT u.email, COUNT(*) as events
-- FROM portal_events pe
-- LEFT JOIN auth.users u ON pe.user_id = u.id
-- WHERE pe.created_at > NOW() - INTERVAL '7 days'
-- GROUP BY u.email
-- ORDER BY events DESC
-- LIMIT 20;

-- Report type popularity
-- SELECT properties->>'report_type' as report_type, COUNT(*) as views
-- FROM portal_events
-- WHERE event_name = 'report_viewed'
--   AND created_at > NOW() - INTERVAL '30 days'
-- GROUP BY properties->>'report_type'
-- ORDER BY views DESC;
