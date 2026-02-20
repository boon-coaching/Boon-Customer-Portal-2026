-- ============================================================================
-- 001-enable-rls-all-tables.sql
-- Enable Row Level Security on all Boon Customer Portal tables.
--
-- This script enables RLS and FORCE RLS on all 14 tables.
-- Note: competency_pre_post is a VIEW and cannot have RLS directly;
--       RLS on its underlying tables (competency_scores) protects it.
-- ============================================================================

-- employee_manager: Core employee roster table
ALTER TABLE employee_manager ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_manager FORCE ROW LEVEL SECURITY;

-- session_tracking: Coaching session records
ALTER TABLE session_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tracking FORCE ROW LEVEL SECURITY;

-- survey_submissions: Unified survey data (baseline + end_of_program)
ALTER TABLE survey_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions FORCE ROW LEVEL SECURITY;

-- program_config: Program settings and configuration
ALTER TABLE program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_config FORCE ROW LEVEL SECURITY;

-- welcome_survey_baseline: Legacy baseline survey data (GROW)
ALTER TABLE welcome_survey_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_survey_baseline FORCE ROW LEVEL SECURITY;

-- welcome_survey_scale: Legacy baseline survey data (Scale)
ALTER TABLE welcome_survey_scale ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_survey_scale FORCE ROW LEVEL SECURITY;

-- competency_scores: Individual competency score records
ALTER TABLE competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_scores FORCE ROW LEVEL SECURITY;

-- focus_area_selections: Employee focus area choices
ALTER TABLE focus_area_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_area_selections FORCE ROW LEVEL SECURITY;

-- portal_events: Analytics/tracking events (uses client_id, not company_id)
ALTER TABLE portal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_events FORCE ROW LEVEL SECURITY;

-- onboarding_steps: Company onboarding task completion tracking
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps FORCE ROW LEVEL SECURITY;

-- manager_surveys: Manager-submitted surveys about employees
ALTER TABLE manager_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_surveys FORCE ROW LEVEL SECURITY;

-- company_logos: Company logo URLs (keyed by company_name)
ALTER TABLE company_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_logos FORCE ROW LEVEL SECURITY;

-- company_account_team: Maps companies to their Boon account team members
ALTER TABLE company_account_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_account_team FORCE ROW LEVEL SECURITY;

-- boon_benchmarks: Shared benchmark data across all companies
ALTER TABLE boon_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE boon_benchmarks FORCE ROW LEVEL SECURITY;

-- NOTE: competency_pre_post is a VIEW, not a table.
-- RLS cannot be applied to views directly. The underlying table
-- (competency_scores) already has RLS enabled above, which protects
-- data accessed through this view. Additionally, consider adding
-- security_barrier to the view definition:
--   ALTER VIEW competency_pre_post SET (security_barrier = true);
