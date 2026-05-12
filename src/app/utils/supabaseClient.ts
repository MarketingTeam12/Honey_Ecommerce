// Singleton Supabase client to avoid multiple instances
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Create a single instance that will be shared across the entire application
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        persistSession: true, // Critical: Persists session across browser restarts
        autoRefreshToken: true, // Critical: Automatically refreshes expired tokens
        detectSessionInUrl: true, // Detects session from OAuth redirects
        storage: typeof window !== 'undefined' ? window.localStorage : undefined, // Uses localStorage for session persistence
      }
    });
    console.log('✅ Supabase client initialized with cross-device session persistence');
  }
  return supabaseInstance;
}

// Export the instance directly for convenience
export const supabase = getSupabaseClient();