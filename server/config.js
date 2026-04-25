/**
 * ────────────────────────────────────────────────────────────────────────────
 * NEXORA — hardkodet konfig
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Verdiene under brukes hvis env-variabler IKKE er satt på Railway.
 *  Lim inn Personal Access Token-en din her for å kunne pushe-og-go.
 *
 *  ⚠️  SIKKERHETSADVARSEL  ⚠️
 *  Tokenet under gir full kontroll over Homey-en din. Når du har lagt
 *  det inn:
 *    1)  Sørg for at GitHub-repoet er PRIVATE  (Settings → Danger Zone)
 *    2)  Aldri del en skjermdump av denne filen offentlig
 *    3)  Hvis tokenet lekker:  gå til my.homey.app/me → API Keys → Slett,
 *        og lag et nytt
 *
 *  Foretrekker du miljøvariabler i Railway i stedet?  La verdiene under
 *  stå som tomme strenger og sett HOMEY_PAT i Railway → Variables.
 *  Begge deler virker — env-variabler vinner over hardkodet konfig.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const config = {
  /** Personal Access Token fra https://my.homey.app/me  →  API Keys */
  HOMEY_PAT: '<<LIM_INN_PAT_HER>>',

  /** Homey Cloud-ID (valgfritt — slås opp automatisk fra PAT om tom) */
  HOMEY_CLOUD_ID: '',

  /** Lokasjon brukt mot met.no for vær-widget */
  HOME_LAT: '60.3913',
  HOME_LON: '5.3221',
  HOME_PLACE: 'Hunstein 48c',

  /** Brukernavn vist i hilsenen */
  USER_NAME: 'Ole',

  /** Sett til true for mock-modus uten Homey-tilkobling */
  DEMO_MODE: false
};

/**
 * Hjelper: hent verdi fra env, ellers fall tilbake til config.
 * Tomme strenger / placeholder behandles som "ikke satt".
 */
export function cfg(key) {
  const env = process.env[key];
  if (env && env.length > 0) return env;
  const v = config[key];
  if (typeof v === 'string' && (v.length === 0 || v.startsWith('<<'))) return undefined;
  return v;
}
