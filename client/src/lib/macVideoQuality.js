/**
 * Videokvalitet for Mac-skjermen: bitraten koderen får bruke når noe beveger seg (i ro brukes langt
 * mindre). Navnene er de samme som i mac-agent (POST /video/quality). Valget er felles for alle som
 * ser samtidig, siden de deler én koder, og det byttes uten at strømmen startes på nytt.
 */
export const VIDEO_QUALITIES = [
  ['low', 'Lav', '2 Mbit/s'],
  ['normal', 'Normal', '5 Mbit/s'],
  ['high', 'Høy', '10 Mbit/s'],
  ['max', 'Maks', '20 Mbit/s']
];
export const DEFAULT_QUALITY = 'normal';
/** Kjent kvalitetsnavn, ellers standard (ukjent, tom, «custom» fra agenten). */
export const validQuality = q => VIDEO_QUALITIES.some(v => v[0] === q) ? q : DEFAULT_QUALITY;
