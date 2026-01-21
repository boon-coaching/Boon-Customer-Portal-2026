-- Portal Events Admin View
-- Run this in Supabase SQL Editor to create views for activity monitoring

-- =============================================
-- VIEW: Recent activity by client (last 30 days)
-- =============================================
CREATE OR REPLACE VIEW portal_activity_by_client AS
SELECT
  c.name as client_name,
  pe.client_id,
  COUNT(DISTINCT pe.user_id) as unique_users,
  COUNT(*) as total_events,
  COUNT(CASE WHEN pe.event_name = 'login' THEN 1 END) as logins,
  COUNT(CASE WHEN pe.event_name = 'dashboard_viewed' THEN 1 END) as dashboard_views,
  COUNT(CASE WHEN pe.event_name = 'report_viewed' THEN 1 END) as report_views,
  COUNT(CASE WHEN pe.event_name = 'report_downloaded' THEN 1 END) as downloads,
  MAX(pe.created_at) as last_active
FROM portal_events pe
LEFT JOIN clients c ON pe.client_id = c.id
WHERE pe.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.name, pe.client_id
ORDER BY last_active DESC;

-- =============================================
-- VIEW: Recent activity by user (last 30 days)
-- =============================================
CREATE OR REPLACE VIEW portal_activity_by_user AS
SELECT
  u.email,
  c.name as client_name,
  COUNT(*) as total_events,
  COUNT(CASE WHEN pe.event_name = 'login' THEN 1 END) as logins,
  COUNT(CASE WHEN pe.event_name = 'report_viewed' THEN 1 END) as report_views,
  COUNT(CASE WHEN pe.event_name = 'report_downloaded' THEN 1 END) as downloads,
  MAX(pe.created_at) as last_active
FROM portal_events pe
LEFT JOIN auth.users u ON pe.user_id = u.id
LEFT JOIN clients c ON pe.client_id = c.id
WHERE pe.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.email, c.name
ORDER BY last_active DESC;

-- =============================================
-- VIEW: Event breakdown (last 30 days)
-- =============================================
CREATE OR REPLACE VIEW portal_event_summary AS
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
-- SELECT pe.*, u.email, c.name as client_name
-- FROM portal_events pe
-- LEFT JOIN auth.users u ON pe.user_id = u.id
-- LEFT JOIN clients c ON pe.client_id = c.id
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
