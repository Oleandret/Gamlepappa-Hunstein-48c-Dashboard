/**
 * ────────────────────────────────────────────────────────────────────────────
 * Gamlepappa Smarthus — hardkodet konfig (fallback)
 * ────────────────────────────────────────────────────────────────────────────
 *  Verdiene under brukes hvis env-variabler IKKE er satt på Railway.
 *  Anbefalt: la dette stå og sett HOMEY_PAT i Railway → Variables.
 *
 *  ⚠️  SIKKERHET ⚠️  — Hardkodet PAT gir full kontroll over Homey.
 *     Sett repoet til Private på GitHub før du committer en ekte verdi.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const config = {
  HOMEY_PAT: '<<LIM_INN_PAT_HER>>',
  HOMEY_CLOUD_ID: '',
  HOME_LAT: '60.3913',
  HOME_LON: '5.3221',
  HOME_PLACE: 'Hunstein 48c',
  USER_NAME: 'Ole',
  DEMO_MODE: false
};

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

/**
 * Get config value: env wins over hardcoded. Empty/placeholder = undefined.
 * Booleans are returned as actual booleans regardless of source.
 */
export function cfg(key) {
  const env = process.env[key];
  const fallback = config[key];

  // Booleans (currently DEMO_MODE)
  if (typeof fallback === 'boolean') {
    if (env != null && env !== '') return TRUTHY.has(String(env).toLowerCase());
    return fallback;
  }

  // Strings
  if (env != null && env !== '') return env;
  if (typeof fallback === 'string' && (fallback === '' || fallback.startsWith('<<'))) return undefined;
  return fallback;
}

/** Single source of truth for "should we serve mock data?" */
export function isDemoMode() {
  if (cfg('DEMO_MODE') === true) return true;
  if (!cfg('HOMEY_PAT')) return true;
  return false;
}
