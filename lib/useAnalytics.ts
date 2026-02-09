import { useCallback, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

interface TrackingContext {
  userId: string | null;
  clientId: string | null;
}

/**
 * Analytics hook for tracking portal usage events.
 *
 * Fire-and-forget design - tracking never blocks or degrades UX.
 * Errors are logged to console in dev but never surface to users.
 *
 * Usage:
 *   const { track } = useAnalytics();
 *   track('report_viewed', { report_type: 'impact' });
 */
export function useAnalytics() {
  const contextRef = useRef<TrackingContext>({ userId: null, clientId: null });
  const initialized = useRef(false);

  // Initialize context from session on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        contextRef.current = {
          userId: session.user.id,
          clientId: session.user.app_metadata?.company_id || null,
        };
      }
    }).catch(() => {
      // Silent fail - tracking context just won't be set
    });

    // Update context on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        contextRef.current = {
          userId: session.user.id,
          clientId: session.user.app_metadata?.company_id || null,
        };
      } else {
        contextRef.current = { userId: null, clientId: null };
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const track = useCallback((
    eventName: string,
    properties: EventProperties = {}
  ) => {
    // Fire and forget - never await, never block
    const { userId, clientId } = contextRef.current;

    // Get current page path
    const pagePath = typeof window !== 'undefined' ? window.location.pathname : null;

    // Insert event asynchronously
    supabase
      .from('portal_events')
      .insert({
        user_id: userId,
        client_id: clientId,
        event_name: eventName,
        properties,
        page_path: pagePath,
      })
      .then(({ error }) => {
        if (error && process.env.NODE_ENV === 'development') {
          console.warn('[Analytics] Failed to track event:', eventName, error.message);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Analytics] Failed to track event:', eventName, err);
        }
      });
  }, []);

  return { track };
}

/**
 * Standalone tracking function for use outside React components.
 * Fetches session on each call - prefer useAnalytics() hook in components.
 */
export async function trackEvent(
  eventName: string,
  properties: EventProperties = {}
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const pagePath = typeof window !== 'undefined' ? window.location.pathname : null;

    await supabase
      .from('portal_events')
      .insert({
        user_id: session?.user?.id || null,
        client_id: session?.user?.app_metadata?.company_id || null,
        event_name: eventName,
        properties,
        page_path: pagePath,
      });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to track event:', eventName, err);
    }
  }
}

// Event name constants for consistency
export const AnalyticsEvents = {
  LOGIN: 'login',
  DASHBOARD_VIEWED: 'dashboard_viewed',
  REPORT_VIEWED: 'report_viewed',
  REPORT_DOWNLOADED: 'report_downloaded',
  EMPLOYEE_VIEWED: 'employee_viewed',
} as const;
