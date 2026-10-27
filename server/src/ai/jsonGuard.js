import { ask } from './router.js';

export class JsonGuardError extends Error {
  constructor(message, { issues, raw, provider } = {}) {
    super(message);
    this.name = 'JsonGuardError';
    this.issues = issues;
    this.raw = raw;
    this.provider = provider;
  }
}

/** Pull a JSON object out of a reply, even if wrapped in ``` fences or chatter. */
export function extractJson(text) {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in reply');
  return JSON.parse(t.slice(start, end + 1));
}

function check(text, schema) {
  let data;
  try {
    data = extractJson(text);
  } catch (err) {
    return { ok: false, problems: [`Not valid JSON: ${err.message}`] };
  }
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    problems: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

/**
 * Ask for structured data and get back validated data, or a JsonGuardError.
 * Returns { data, provider, model, repaired, attempts }.
 */
export async function askJson(task, { messages, schema, schemaHint, maxTokens = 2000, temperature = 0.7 }) {
  const system = {
    role: 'system',
    content:
      'Respond with ONLY a single JSON object. No markdown, no code fences, no commentary.' +
      (schemaHint ? `\nIt must match this shape exactly:\n${schemaHint}` : ''),
  };
  const baseMessages = [system, ...messages];

  // Attempt 1: normal generation.
  const first = await ask(task, { messages: baseMessages, json: true, maxTokens, temperature });
  const firstCheck = check(first.text, schema);
  if (firstCheck.ok) {
    return { data: firstCheck.data, provider: first.provider, model: first.model, repaired: false, attempts: first.attempts };
  }

  // Attempt 2: show the model its own mistakes and ask for a fix.
  const repairMessages = [
    ...baseMessages,
    { role: 'assistant', content: first.text },
    {
      role: 'user',
      content: `That JSON has these problems:\n- ${firstCheck.problems.join('\n- ')}\nReturn the complete, corrected JSON object only.`,
    },
  ];
  const second = await ask(task, { messages: repairMessages, json: true, maxTokens, temperature: 0.2 });
  const secondCheck = check(second.text, schema);
  if (secondCheck.ok) {
    return {
      data: secondCheck.data,
      provider: second.provider,
      model: second.model,
      repaired: true,
      attempts: [...first.attempts, ...second.attempts],
    };
  }

  throw new JsonGuardError(`AI returned invalid JSON for task "${task}", even after repair`, {
    issues: secondCheck.problems,
    raw: second.text,
    provider: second.provider,
  });
}
