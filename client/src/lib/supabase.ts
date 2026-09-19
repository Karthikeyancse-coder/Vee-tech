/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Support both Next.js App Router (process.env.NEXT_PUBLIC_*) and Vite (import.meta.env.*)
const getEnv = (key: string, fallback: string = ''): string => {
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
  if (globalObj?.process?.env && globalObj.process.env[key]) {
    return globalObj.process.env[key];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  return fallback;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', getEnv('VITE_SUPABASE_URL', 'https://cwpwvcwiyuikytqyetii.supabase.co'));
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', getEnv('VITE_SUPABASE_ANON_KEY', ''));

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    })
  : null;
