import { query, isEnabled } from '../lib/db.js';
import { chat, openaiEnabled } from '../lib/openaiClient.js';
import { homeyClient } from '../lib/homeyClient.js';
import { isDemoMode } from '../config.js';
import { MOCK_FLOWS } from '../lib/mockData.js';

/**
 * Lag 3 — leser topp-rangerte patterns fra databasen, beriker med kontekst
 * (eksisterende Homey-flows, husinfo) og ber GPT om strukturerte forslag
 * til nye automatiseringer.
 *
 * Output lagres i `suggestions`-tabellen. Brukeren kan akseptere/avvise
 * via UI.
 */

const SYSTEM_PROMPT = `Du er en smarthus-ekspert som finner gode kandidater til automatiseringer i Homey Pro.
Du får en liste over observerte mønstre fra hjemmets enheter siste 30 dager, og en liste over eksisterende Homey-flows.

Din oppgave er å foreslå 3-7 nye automatiseringer som virker mest verdifulle for huseieren.
Reglene:
- Forslagene må basere seg på mønstrene som er gitt — ikke finn opp ting.
- Foreslå IKKE noe som ligner en flow som allerede finnes.
- Vær konkret om trigger og handling: nevn faktiske enhetsnavn og verdier.
- Forklar HVORFOR forslaget er nyttig (hvilke mønstre det er basert på).
- Sett konfidens: "high" hvis flere mønstre peker mot det, "medium" hvis ett sterkt mønster, "low" hvis usikkert.
- Skriv på norsk.

Returner JSON med følgende form:
{
  "suggestions": [
    {
      "title": "Kort tittel (≤ 60 tegn)",
      "description": "1-2 setninger som beskriver flow-en",
      "trigger": "Når X skjer (konkret beskrivelse av trigger)",
      "action": "Da skal Y skje (konkret beskrivelse av handling)",
      "why": "Forklaring av hvilke mønstre dette baseres på (≤ 200 tegn)",
      "confidence": "high|medium|low",
      "patternIds": [1, 3, 7]
    }
  ]
}`;

async function loadExistingFlows() {
  if (isDemoMode()) return Object.values(MOCK_FLOWS);
  try {
    return await homeyClient.listFlows();
  } catch (err) {
    console.warn('[suggestion-engine] could not load flows:', err.message);
    return [];
  }
}

async function loadTopPatterns(limit = 40) {
  const res = await query(`
    SELECT id, kind, description, data, confidence, support, score
    FROM patterns
    WHERE active = true
    ORDER BY score DESC NULLS LAST
    LIMIT $1
  `, [limit]);
  return res.rows;
}

function buildUserPrompt(patterns, flows) {
  const flowList = flows
    .filter(f => f.enabled !== false)
    .slice(0, 80)
    .map(f => `- ${f.name}${f.folder ? ` (${f.folder})` : ''}`)
    .join('\n');

  const patternList = patterns.map(p => {
    return `[id ${p.id}] (${p.kind}, score ${(p.score || 0).toFixed(2)}, støtte ${p.support}, konfidens ${(p.confidence || 0).toFixed(2)})\n  ${p.description}`;
  }).join('\n\n');

  return `## Eksisterende Homey-flows (ikke foreslå duplikater):
${flowList || '(ingen)'}

## Observerte mønstre (siste 30 dager):
${patternList || '(ingen mønstre — for lite data)'}

Returner JSON med 3-7 forslag basert på disse mønstrene.`;
}

export async function runSuggestionEngine() {
  if (!isEnabled()) return { error: 'database not configured' };
  if (!openaiEnabled()) return { error: 'OPENAI_API_KEY not set' };

  const startedAt = Date.now();
  const patterns = await loadTopPatterns(40);
  if (patterns.length === 0) {
    return { error: 'no active patterns yet — kjør pattern-detection først' };
  }
  const flows = await loadExistingFlows();

  let response;
  try {
    response = await chat({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(patterns, flows),
      temperature: 0.3,
      maxTokens: 2500,
      json: true
    });
  } catch (err) {
    console.error('[suggestion-engine] LLM call failed:', err.message);
    return { error: 'LLM call failed: ' + err.message };
  }

  const items = Array.isArray(response.parsed?.suggestions) ? response.parsed.suggestions : [];
  if (items.length === 0) {
    return { error: 'LLM returned no suggestions', raw: response.raw };
  }

  // Markér forrige bunke som outdated (status='later') så vi får frisk visning,
  // men beholder dem hvis bruker hadde aksept/avvis-status.
  await query(`UPDATE suggestions SET status = 'later' WHERE status = 'pending'`);

  let saved = 0;
  for (const s of items) {
    if (!s?.title || !s?.description) continue;
    const patternIds = Array.isArray(s.patternIds) ? s.patternIds.filter(Number.isInteger) : [];
    await query(
      `INSERT INTO suggestions (title, description, trigger_text, action_text, why, confidence, pattern_ids, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        String(s.title).slice(0, 200),
        String(s.description).slice(0, 1000),
        String(s.trigger || '').slice(0, 500),
        String(s.action || '').slice(0, 500),
        String(s.why || '').slice(0, 500),
        ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'medium',
        patternIds,
        response.model || null
      ]
    );
    saved++;
  }

  return {
    ok: true,
    saved,
    patternsConsidered: patterns.length,
    model: response.model,
    usage: response.usage,
    durationMs: Date.now() - startedAt
  };
}
