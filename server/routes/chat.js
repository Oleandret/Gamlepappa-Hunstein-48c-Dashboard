import { Router } from 'express';
import { openaiEnabled } from '../lib/openaiClient.js';
import { listTools, callTool, toOpenAITools, mcpUrl, resetSession, getLastRawResponse } from '../lib/mcpClient.js';
import { getNamespace } from '../lib/configStore.js';

export const chatRoutes = Router();

const FALLBACK_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const MAX_TOOL_ITERATIONS = Number(process.env.CHAT_MAX_ITERATIONS) || 15;

/**
 * Hent chat-modellen fra config (slot 'chat'). Faller tilbake til env og
 * deretter til hardcoded default. Leses ved hver request slik at endring
 * i Innstillinger trer i kraft umiddelbart.
 */
async function getChatModel() {
  try {
    const cfg = await getNamespace('aiModels');
    const m = cfg?.chat;
    if (typeof m === 'string' && m.trim()) return m.trim();
  } catch { /* ignore */ }
  return FALLBACK_MODEL;
}

const SYSTEM_PROMPT = `Du er en smart-hus-assistent for Gamlepappa Hunstein 48c.
Du har tilgang til Homey-verktøy via MCP som lar deg lese og styre alle enhetene i huset og på hytta.

VIKTIG OM SPRÅK:
- Brukeren snakker norsk. Svar ALLTID på norsk.
- MEN: MCP-verktøyene er engelske og forstår kun engelske nøkkelord.
  Når du søker eller filtrerer, bruk engelske termer:
    "lys" → "light"
    "stue" → "living room"
    "soverom" → "bedroom"
    "kjøkken" → "kitchen"
    "dør/lås" → "door" / "lock"
    "bevegelse" → "motion"
    "temperatur" → "temperature"
    "av/på" → "onoff"
- Når du svarer brukeren, oversett tilbake til norsk navn.

ARBEIDSFLYT:
1. For å forstå huset: START MED 'get_home_structure' UTEN argumenter.
   Det gir deg lista av soner, rom og enheter med deres UUID-er.
2. Bruk UUID-er (ikke navn som "Hjem" eller "Stue") som zoneId/deviceId
   i påfølgende kall.
3. For å finne en spesifikk enhet, bruk search_tools med ENGELSKE nøkkelord
   (f.eks. "light" eller "lamp", ikke "lys").
4. For å styre noe, bruk det aktuelle set/control-verktøyet med riktig
   UUID og verdi.
5. Bekreft kort hva du gjorde — på norsk, uten å vise tekniske ID-er.

FEILSØKING:
- Hvis et verktøy returnerer tomt resultat, prøv å reformulere argumentene
  eller starte med get_home_structure for å hente riktig kontekst.
- Ikke kall samme verktøy med samme argumenter to ganger på rad.
- Si fra til brukeren hva som gikk galt — ikke bare prøv blindt.

Ikke finn opp enheter eller resultater. Vær konsis.`;

async function callOpenAI({ messages, tools, model }) {
  const body = {
    model,
    messages,
    tools: tools && tools.length ? tools : undefined,
    tool_choice: tools && tools.length ? 'auto' : undefined,
    temperature: 0.3,
    max_tokens: 1500
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
  return res.json();
}

function mcpContentToString(result) {
  // MCP tool-call resultat: { content: [{type:'text', text:'...'}, ...], isError?: bool }
  if (result === null || result === undefined) return '(verktøyet returnerte ingenting)';
  if (typeof result === 'string') return result.length ? result : '(tom streng)';
  if (Array.isArray(result.content) && result.content.length > 0) {
    const parts = result.content
      .map(p => {
        if (p?.type === 'text' && typeof p.text === 'string') return p.text;
        if (p?.type === 'image') return '[bilde]';
        if (p?.type === 'resource') return `[ressurs: ${p.resource?.uri || ''}]`;
        return JSON.stringify(p);
      })
      .filter(Boolean);
    const joined = parts.join('\n');
    return joined.length ? joined : '(tomt content-array)';
  }
  // Fallback — vis hele resultat-objektet
  const s = JSON.stringify(result);
  return s && s !== '{}' && s !== '[]' ? s : '(tomt resultat)';
}

chatRoutes.get('/status', async (_req, res) => {
  const model = await getChatModel();
  res.json({
    llm: openaiEnabled(),
    mcpUrl: mcpUrl(),
    model,
    fallbackModel: FALLBACK_MODEL
  });
});

chatRoutes.get('/tools', async (_req, res, next) => {
  try {
    const tools = await listTools();
    res.json({ tools });
  } catch (err) {
    next(err);
  }
});

chatRoutes.post('/reset', async (_req, res) => {
  resetSession();
  res.json({ ok: true });
});

/**
 * Hovedkall. Klienten sender hele conversation-historien som array.
 * Vi henter tools fra MCP, gir til OpenAI, og kjører iterativt tool-loop
 * inntil ferdig (eller MAX_TOOL_ITERATIONS).
 *
 * Body: { messages: [{role, content, tool_calls?, tool_call_id?}] }
 * Response: { messages: [...all assistant/tool messages produced...], finalMessage, toolCalls: [...] }
 */
chatRoutes.post('/message', async (req, res, next) => {
  try {
    if (!openaiEnabled()) return res.status(400).json({ error: 'OPENAI_API_KEY ikke satt' });
    const inboundMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (inboundMessages.length === 0) return res.status(400).json({ error: 'mangler messages' });

    // Hent tools fra MCP. Hvis MCP er nede, prøv likevel uten tools.
    let mcpTools = [];
    try {
      mcpTools = await listTools();
    } catch (err) {
      console.warn('[chat] MCP listTools failed:', err.message);
    }
    const openaiTools = toOpenAITools(mcpTools);

    // Bygg historikk inn i OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...inboundMessages.filter(m => m && m.role)
    ];

    const newMessages = []; // det vi sender tilbake til klienten
    const toolCallsExecuted = [];

    const model = await getChatModel();
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const openaiResponse = await callOpenAI({ messages, tools: openaiTools, model });
      const choice = openaiResponse.choices?.[0];
      if (!choice) throw new Error('OpenAI returnerte ingen choices');
      const assistantMsg = choice.message;

      // Legg til assistant-meldingen i historikken
      const persistAssistant = {
        role: 'assistant',
        content: assistantMsg.content || '',
        tool_calls: assistantMsg.tool_calls
      };
      messages.push(persistAssistant);
      newMessages.push(persistAssistant);

      // Hvis ingen tool-calls — vi er ferdige
      if (!Array.isArray(assistantMsg.tool_calls) || assistantMsg.tool_calls.length === 0) {
        return res.json({
          messages: newMessages,
          finalMessage: persistAssistant,
          toolCalls: toolCallsExecuted,
          iterations: iter + 1,
          usage: openaiResponse.usage,
          model: openaiResponse.model
        });
      }

      // Kjør hver tool-call
      for (const tc of assistantMsg.tool_calls) {
        const fn = tc.function || {};
        const name = fn.name;
        let args = {};
        try { args = fn.arguments ? JSON.parse(fn.arguments) : {}; }
        catch { args = {}; }

        let resultText, isError = false;
        let debugInfo = null;
        try {
          const result = await callTool(name, args);
          resultText = mcpContentToString(result);
          if (result?.isError) isError = true;
          debugInfo = getLastRawResponse();
        } catch (err) {
          resultText = `Verktøy-feil: ${err.message}`;
          isError = true;
          debugInfo = getLastRawResponse();
        }
        toolCallsExecuted.push({
          name,
          args,
          isError,
          result: resultText.slice(0, 4000),
          debug: debugInfo
        });

        const toolMsg = {
          role: 'tool',
          tool_call_id: tc.id,
          content: resultText.slice(0, 8000)
        };
        messages.push(toolMsg);
        newMessages.push(toolMsg);
      }
    }

    // Hvis vi når MAX_TOOL_ITERATIONS, returner det vi har med en feilmelding
    return res.json({
      messages: newMessages,
      finalMessage: { role: 'assistant', content: 'Beklager, jeg klarte ikke å fullføre — for mange iterasjoner.' },
      toolCalls: toolCallsExecuted,
      truncated: true
    });
  } catch (err) { next(err); }
});
