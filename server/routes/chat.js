import { Router } from 'express';
import { openaiEnabled } from '../lib/openaiClient.js';
import { listTools, callTool, toOpenAITools, mcpUrl, resetSession } from '../lib/mcpClient.js';

export const chatRoutes = Router();

const DEFAULT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const MAX_TOOL_ITERATIONS = 8;

const SYSTEM_PROMPT = `Du er en smart-hus-assistent for Gamlepappa Hunstein 48c.
Du har tilgang til Homey-verktøy som lar deg lese og styre alle enhetene i huset og på hytta.
Brukeren snakker norsk. Vær konsis og hjelpsom.

Når brukeren ber deg gjøre noe:
1. Bruk passende verktøy for å hente nødvendig informasjon eller utføre handlinger.
2. Bekreft kort hva du gjorde (eller hva du fant), uten å lire opp tekniske detaljer.
3. Hvis du er usikker på hvilken enhet brukeren mener, spør.
4. For "skru på/av" — bruk verktøy som styrer onoff-capability på riktig enhet.
5. For statusforespørsler — bruk read-verktøy og gi et menneskelig sammendrag.

Ikke finn opp enheter eller resultater. Hvis et verktøy feiler, si fra hva som gikk galt.`;

async function callOpenAI({ messages, tools, model = DEFAULT_MODEL }) {
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
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (Array.isArray(result.content)) {
    return result.content
      .map(p => p?.type === 'text' ? p.text : JSON.stringify(p))
      .join('\n');
  }
  return JSON.stringify(result);
}

chatRoutes.get('/status', async (_req, res) => {
  res.json({
    llm: openaiEnabled(),
    mcpUrl: mcpUrl(),
    model: DEFAULT_MODEL
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

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const openaiResponse = await callOpenAI({ messages, tools: openaiTools });
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
        try {
          const result = await callTool(name, args);
          resultText = mcpContentToString(result);
          if (result?.isError) isError = true;
        } catch (err) {
          resultText = `Verktøy-feil: ${err.message}`;
          isError = true;
        }
        toolCallsExecuted.push({ name, args, isError, result: resultText.slice(0, 4000) });

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
