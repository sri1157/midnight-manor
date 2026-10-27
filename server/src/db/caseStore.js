import { supabase, isDbConfigured } from './supabase.js';

function requireDb() {
  if (!isDbConfigured()) throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY).');
}

/** Save a generated case to the pool. Returns its id. */
export async function saveCase({ caseData, meta, validation }) {
  requireDb();
  const { data, error } = await supabase
    .from('cases')
    .insert({
      title: caseData.title,
      theme: meta.theme,
      provider: meta.provider,
      model: meta.model,
      attempts: validation.attempts,
      passed: validation.warnings.length === 0,
      case_json: caseData,
      meta,
      validation,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Saving case failed: ${error.message}`);
  return data.id;
}

/** Atomically take the oldest ready case for a new game, or null if the pool is empty. */
export async function claimCase() {
  requireDb();
  const { data, error } = await supabase.rpc('claim_case');
  if (error) throw new Error(`Claiming case failed: ${error.message}`);
  const row = data?.[0];
  return row ? { id: row.id, caseData: row.case_json, meta: row.meta } : null;
}

/** How many cases are waiting in the pool. */
export async function countReadyCases() {
  requireDb();
  const { count, error } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ready');

  if (error) throw new Error(`Counting cases failed: ${error.message}`);
  return count ?? 0;
}

/** Read the best ready case WITHOUT claiming it (development only). */
export async function peekCase() {
  requireDb();
  const { data, error } = await supabase
    .from('cases')
    .select('id, case_json, meta')
    .eq('status', 'ready')
    .order('passed', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Peeking case failed: ${error.message}`);
  return data ? { id: data.id, caseData: data.case_json, meta: data.meta } : null;
}
