import { supabase, isDbConfigured } from './supabase.js';

/** Log one question and answer. Never throws; failures are only logged. */
export async function saveInterrogation(row) {
  if (!isDbConfigured()) return;
  try {
    const { error } = await supabase.from('interrogations').insert({
      game_id: row.gameId,
      room_code: row.roomCode,
      case_id: row.caseId ?? null,
      suspect_id: row.suspectId,
      asker: row.asker,
      question: row.question,
      answer: row.answer,
      provider: row.provider ?? null,
      latency_ms: row.latencyMs ?? null,
    });
    if (error) console.error('Saving interrogation failed:', error.message);
  } catch (err) {
    console.error('Saving interrogation failed:', err.message);
  }
}
