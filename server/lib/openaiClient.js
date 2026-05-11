/**
 * Minimal OpenAI Chat Completions-klient. Bruker fetch direkte for å unngå
 * å dra inn en SDK med tunge avhengigheter.
 *
 * Aktiveres kun hvis OPENAI_API_KEY er satt som env-variabel.
 */

const API_URL = 'https://api.openai.com/v1/chat/completions';
// gpt-4o-mini er kostnadseffektiv og god nok til strukturert output.
// Bytt til gpt-4o om du vil ha bedre kvalitet på forslagene.
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function openaiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chat({ system, user, model = DEFAULT_MODEL, json = true, temperature = 0.3, maxTokens = 2000 }) {
  if (!openaiEnabled()) throw new Error('OPENAI_API_KEY not set');

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
    max_tokens: maxTokens
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI response had no content');

  if (json) {
    try { return { parsed: JSON.parse(content), raw: content, model: data.model, usage: data.usage }; }
    catch (err) { throw new Error(`Failed to parse JSON response: ${err.message}\nRaw: ${content.slice(0, 300)}`); }
  }
  return { text: content, model: data.model, usage: data.usage };
}
