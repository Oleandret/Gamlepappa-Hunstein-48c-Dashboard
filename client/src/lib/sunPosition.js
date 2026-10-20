/**
 * Solposisjon for Hunstein (Hundvåg) — forenklet NOAA/Meeus-algoritme,
 * nøyaktig til omtrent ±0,5° i vårt tidsrom. Brukes til sol, skygger og
 * dag/natt-lys i 3D-modellen.
 *
 * Plantegningene er ikke nordvendt: på situasjonsplanen (tegn. 756-011)
 * ligger husets lengdeakse 35° mot klokka fra øst. Modellens +x (garasje →
 * terrasse) peker derfor mot ~55° (nordøst), og «opp» på plantegningen (−z)
 * mot ~325° (nordvest).
 */

/** Hvor mange grader plantegningens «opp» er dreid vest for sann nord. */
export const MODEL_NORTH_OFFSET = 35;

export const HUNSTEIN = { lat: 58.99, lon: 5.75 };   // Hundvåg, Stavanger

const RAD = Math.PI / 180;

/** { elevation, azimuth } i grader. Azimut måles fra nord, med klokka (øst = 90°). */
export function sunPosition(date = new Date(), lat = HUNSTEIN.lat, lon = HUNSTEIN.lon) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // dager siden J2000
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const H = (gmst * 15 + lon) * RAD - ra;
  const phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { elevation: el / RAD, azimuth: ((az / RAD) + 360) % 360 };
}

/** Enhetsvektor [x, y, z] mot sola i modellens koordinater. */
export function sunDirection({ elevation, azimuth }, northOffset = MODEL_NORTH_OFFSET) {
  const el = elevation * RAD, az = (azimuth + northOffset) * RAD;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }

/**
 * Lysoppsett ut fra solhøyden: dag, skumring (gylden time) og natt.
 * Farger er hex-strenger; intensiteter er tilpasset scenens øvrige lys.
 */
export function skyLighting(elevation) {
  const day = clamp01((elevation + 2) / 14);          // 0 under −2°, 1 over 12°
  const golden = clamp01(1 - Math.abs(elevation - 3) / 9) * (elevation > -4 ? 1 : 0);
  const mix = (c1, c2, t) => {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ch = s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
  };
  const sky = mix('#05070d', '#1b3a5c', day);
  return {
    phase: elevation > 6 ? 'dag' : elevation > -6 ? 'skumring' : 'natt',
    isNight: elevation < -2,
    sunIntensity: elevation > -1 ? lerp(0.15, 1.5, day) : 0,
    sunColor: mix('#ffd2a0', '#fff6e8', clamp01(elevation / 25)),
    ambient: lerp(0.32, 0.55, day),
    hemiSky: mix('#3a4f8f', '#a9dcff', day),
    background: golden > 0.05 ? mix(sky, '#3a2a3f', golden * 0.45) : sky,
    moonIntensity: day < 0.2 ? 0.35 * (1 - day / 0.2) : 0
  };
}

/** «06:42» / «19:15» — soloppgang og -nedgang for datoen, eller null ved midnattssol/mørketid. */
export function sunTimes(date = new Date(), lat = HUNSTEIN.lat, lon = HUNSTEIN.lon) {
  const base = new Date(date); base.setHours(0, 0, 0, 0);
  let rise = null, set = null, prev = null;
  for (let m = 0; m <= 24 * 60; m += 5) {
    const t = new Date(base.getTime() + m * 60000);
    const el = sunPosition(t, lat, lon).elevation + 0.833;   // refraksjon + soldiameter
    if (prev != null) {
      if (prev <= 0 && el > 0 && !rise) rise = t;
      if (prev > 0 && el <= 0) set = t;
    }
    prev = el;
  }
  const fmt = t => t && t.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return { sunrise: fmt(rise), sunset: fmt(set) };
}
