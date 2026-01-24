import { createClient } from '@supabase/supabase-js';

// Read from Vite environment variables (must be prefixed with VITE_)
// SECURITY: No fallback values - env vars are required
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
}

// Initialize the Supabase client with increased row limit
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'boon-dashboard' },
  },
});