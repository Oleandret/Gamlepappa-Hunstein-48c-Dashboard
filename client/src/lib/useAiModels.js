import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

/**
 * Hvilken OpenAI-modell som brukes for ulike AI-funksjoner i appen.
 *
 * Slots:
 *   chat        — AI-chat-fanen
 *   suggestions — automatiserings-forslag på Innsikt-fanen
 */

const DEFAULTS = {
  chat: 'gpt-4o-mini',
  suggestions: 'gpt-4o-mini'
};

export const AVAILABLE_MODELS = [
  { id: 'gpt-4o-mini',     label: 'GPT-4o mini', tier: 'rask + billig (default)' },
  { id: 'gpt-4o',          label: 'GPT-4o',      tier: 'beste kvalitet' },
  { id: 'gpt-4.1',         label: 'GPT-4.1',     tier: 'nyere generasjon, høy kvalitet' },
  { id: 'gpt-4.1-mini',    label: 'GPT-4.1 mini', tier: 'nyere generasjon, billig' },
  { id: 'gpt-4-turbo',     label: 'GPT-4 turbo', tier: 'eldre flaggskip' },
  { id: 'gpt-3.5-turbo',   label: 'GPT-3.5 turbo', tier: 'gammel, veldig billig' }
];

function sanitize(cfg) {
  if (!cfg || typeof cfg !== 'object') return { ...DEFAULTS };
  return {
    chat: typeof cfg.chat === 'string' && cfg.chat ? cfg.chat : DEFAULTS.chat,
    suggestions: typeof cfg.suggestions === 'string' && cfg.suggestions ? cfg.suggestions : DEFAULTS.suggestions
  };
}

export function useAiModels() {
  const [config, setConfig, sync] = useServerSyncedState('aiModels', DEFAULTS);
  const clean = sanitize(config);

  const set = useCallback((slot, modelId) => {
    setConfig(prev => ({ ...sanitize(prev), [slot]: modelId }));
  }, [setConfig]);

  return { config: clean, set, defaults: DEFAULTS, sync };
}
