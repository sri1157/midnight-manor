import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../config.js';

const apiKey = env('PINECONE_API_KEY');
const host = env('PINECONE_INDEX_HOST');

const index = apiKey && host ? new Pinecone({ apiKey }).index({ host }) : null;

export const isMemoryConfigured = () => index !== null;

const withTimeout = (promise, ms, fallback) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);

/** Store one exchange. Never throws. */
export async function remember({ gameId, suspectId, turn, asker, question, answer }) {
  if (!index) return;
  try {
    await index.upsertRecords({
      records: [{
        id: `${gameId}-${suspectId}-${turn}`,
        chunk_text: `Detective ${asker} asked: ${question}\nYou answered: ${answer}`,
        game_id: gameId,
        suspect_id: suspectId,
        turn,
      }],
    });
  } catch (err) {
    console.error('Memory save failed:', err.message);
  }
}

/** Older exchanges related to `text`, as plain strings. Never throws; empty on timeout. */
export async function recall({ gameId, suspectId, text, beforeTurn, topK = 3 }) {
  if (!index) return [];
  try {
    const result = await withTimeout(
      index.searchRecords({
        query: {
          topK,
          inputs: { text },
          filter: {
            game_id: { $eq: gameId },
            suspect_id: { $eq: suspectId },
            turn: { $lt: beforeTurn },
          },
        },
        fields: ['chunk_text'],
      }),
      1500,
      null,
    );
    return (result?.result?.hits ?? []).map((hit) => hit.fields?.chunk_text).filter(Boolean);
  } catch (err) {
    console.error('Memory recall failed:', err.message);
    return [];
  }
}
