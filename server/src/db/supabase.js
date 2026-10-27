import { createClient } from '@supabase/supabase-js';
import { env } from '../config.js';

const url = env('SUPABASE_URL');
const secretKey = env('SUPABASE_SECRET_KEY');

/** Server-only client. The secret key bypasses RLS, so it must never reach a browser. */
export const supabase = url && secretKey
  ? createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export const isDbConfigured = () => supabase !== null;
