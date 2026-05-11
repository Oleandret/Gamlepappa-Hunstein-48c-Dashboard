import { chat, openaiEnabled } from './openaiClient.js';
import { homeyClient } from './homeyClient.js';
import { isDemoMode } from '../config.js';
import { MOCK_DEVICES } from './mockData.js';

/**
 * Konverterer en natural-language suggestion til en STRUKTURERT
 * auto-flow med trigger + actions som kan kjøres av serveren.
 *
 * Trigger-typer:
 *   { type: 'device_change', deviceId, capability, condition: 'equals'|'becomes_true'|'becomes_false'|'changes', value? }
 *
 * Action-typer:
 *   { type: 'set_capability', deviceId, capability, value }
 *   { type: 'run_flow', flowId }
 *
 * Returnerer { ok, flow, raw, model } eller { ok: false, error }.
 */

const SYSTEM_PROMPT = `Du er en oversetter som konverterer et tekst-forslag til en automatisering, til en STRUKTURERT JSON-flow som kan kjøres av et serversystem.

Du får:
- Et forslag (tittel, beskrivelse, trigger-tekst, action-tekst)
- En liste over alle enheter i Homey (id, name, class, capabilities)

Din oppgave er å returnere én JSON-flow med følgende form:
{
  "title": "Kort tittel",
  "description": "1-2 setninger",
  "trigger": {
    "type": "device_change",
    "deviceId": "<exakt id fra enhetslisten>",
    "capability": "<capability-navn, f.eks. onoff, locked, alarm_motion>",
    "condition": "becomes_true" | "becomes_false" | "equals" | "changes",
    "value": <verdi hvis condition er 'equals'>
  },
  "actions": [
    {
      "type": "set_capability",
      "deviceId": "<exakt id>",
      "capability": "<cap-navn>",
      "value": true | false | <number> | "<string>"
    }
  ]
}

Regler:
- deviceId MÅ være eksakt fra enhetslisten — ikke finn opp.
- Hvis en enhet eller capability ikke finnes som matcher forslaget, returner i stedet:
  { "error": "Kort norsk forklaring av hva som mangler" }
- For onoff-capability: condition='becomes_true' = "slås på", 'becomes_false' = "slås av".
- For dim/temperatur: bruk 'equals' med spesifikk verdi, eller 'changes' for hvilken-som-helst-endring.
- Actions skal være konkrete og direkte realiserbare via setCapability.
- Hvis trigger involverer en "scene" eller "scene-knapp" som finnes som flow i Homey, bruk type='run_flow'.

Returner KUN JSON — ingen prosa.`;

async function loadDevices() {
  if (isDemoMode()) return MOCK_DEVICES;
  try {
    return await homeyClient.listDevices();
  } catch (err) {
    console.warn('[flow-compiler] failed to load devices:', err.message);
    return [];
  }
}

function deviceSummary(d) {
  const caps = (Array.isArray(d.capabilities) ? d.capabilities : Object.keys(d.capabilities || d.capabilitiesObj || {})).join(',');
  return `${d.id} | ${d.name} | ${d.class} | caps: ${caps}`;
}

export async function compileSuggestionToFlow(suggestion) {
  if (!openaiEnabled()) return { ok: false, error: 'OPENAI_API_KEY ikke satt' };
  if (!suggestion) return { ok: false, error: 'mangler suggestion' };

  const devices = await loadDevices();
  const devList = (Array.isArray(devices) ? devices : Object.values(devices || {}))
    .slice(0, 250)
    .map(deviceSummary)
    .join('\n');

  const userPrompt = `## Tilgjengelige enheter:
${devList || '(ingen)'}

## Forslag:
- Tittel: ${suggestion.title}
- Beskrivelse: ${suggestion.description}
- Trigger (natural language): ${suggestion.trigger_text || suggestion.trigger || '—'}
- Handling (natural language): ${suggestion.action_text || suggestion.action || '—'}

Konverter dette til en strukturert flow-JSON.`;

  try {
    const response = await chat({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.0,  // deterministisk for kompilering
      maxTokens: 1500,
      json: true
    });
    const parsed = response.parsed;
    if (parsed?.error) {
      return { ok: false, error: parsed.error, raw: response.raw };
    }
    // Valider minimumsfelter
    if (!parsed?.trigger?.type || !Array.isArray(parsed?.actions) || parsed.actions.length === 0) {
      return { ok: false, error: 'LLM returnerte ugyldig flow-struktur', raw: response.raw };
    }
    return { ok: true, flow: parsed, raw: response.raw, model: response.model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
