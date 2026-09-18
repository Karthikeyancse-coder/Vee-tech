/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string, fallback: string): string => {
  // Vite environment
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const val = (import.meta as any).env[key];
    if (val) return val;
  }
  // Next.js / Node environment
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env) {
    const val = (globalThis as any).process.env[key];
    if (val) return val;
  }
  return fallback;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', getEnvVar('NEXT_PUBLIC_SUPABASE_URL', ''));
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''));

export const isSupabaseConfigured = 
  Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Production Supabase client with Realtime enabled.
 * Subscribes to PostgreSQL changes over WebSockets for zero-latency UI updates.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20
    }
  }
    })
  : null;
