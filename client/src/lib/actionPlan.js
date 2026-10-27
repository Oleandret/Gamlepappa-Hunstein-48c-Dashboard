/**
 * Tiltaksplan for Strømsparing: konkrete, regelbaserte forslag fra live data.
 * Ingenting styres herfra; hvert tiltak beskriver hva som kan gjøres, hvorfor,
 * og et forslag til Homey-flow. Besparelser beregnes bare fra målt effekt
 * (W) og publisert spotpris; ellers står anslaget som ukjent.
 *
 * Inndata:
 *  rows      inventory()-rader (målt effekt med kvalitet)
 *  devices   Homey-enheter (class, capabilitiesObj.onoff/target_temperature)
 *  presence  { known: bool, anyoneHome: bool, people: [{person, home}] }
 *  prices    publiserte intervaller [{start,end,value}] for i dag (NOK/kWh)
 */

// Kan trygt slås av når huset er tomt (klasse). Alt annet behandles som ukjent/kritisk.
const SWITCHABLE = new Set(['light', 'socket', 'tv', 'speaker', 'amplifier', 'fan', 'kettle', 'coffeemachine', 'mediaplayer']);
// Navn som tyder på noe som må stå på uansett.
const CRITICAL_NAME = /(kj.l|frys|fridge|freezer|router|deco|wi-?fi|switch|nett|homey|bridge|hub|alarm|kamera|camera|pumpe|pump|ventil|varmtvann|bereder|vvb|akvarium|server|nas|modem|brann|smoke|lader|charger|tesla|zaptec|easee|varme|heat|termostat|panelovn|gulvvarme|sikring|medisin|oksygen)/i;

// Homey oppdaterer tidspunktet bare når verdien endres, så en jevn last kan ha
// eldre kildetid. For forslag holder det at enheten er tilgjengelig og målt siste 6 timer.
export const PLAN_MAX_AGE_MS = 6 * 3600000;
const usable = (r, devices, now) => Number.isFinite(r?.power?.value) && r.power.quality !== 'missing' && devices[r.id]?.available !== false
  && (r.power.quality === 'measured' || r.power.quality === 'demo' || (Number.isFinite(r.power.at) && now - r.power.at <= PLAN_MAX_AGE_MS));
const kwhPerHour = watts => watts / 1000;
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function priceStats(prices = [], now = Date.now()) {
  const list = prices.filter(p => Number.isFinite(p.value) && Number.isFinite(p.start));
  if (!list.length) return null;
  const vals = list.map(p => p.value), avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sorted = [...vals].sort((a, b) => a - b), q75 = sorted[Math.floor(sorted.length * 0.75)];
  const current = list.find(p => p.start <= now && now < p.end) || null;
  // Billigste sammenhengende 3-timersvindu som ikke er passert.
  const ahead = list.filter(p => p.end > now);
  let best = null;
  for (let i = 0; i + 2 < ahead.length; i++) {
    const w = ahead.slice(i, i + 3);
    if (w[2].start - w[0].start !== 2 * (w[1].start - w[0].start)) continue;
    const mean = (w[0].value + w[1].value + w[2].value) / 3;
    if (!best || mean < best.mean) best = { start: w[0].start, end: w[2].end, mean };
  }
  return { avg, q75, current, best, expensiveNow: current ? current.value >= q75 : false };
}

export function buildActionPlan({ rows = [], devices = {}, presence = { known: false }, prices = [], now = Date.now() }) {
  const ps = priceStats(prices, now);
  const kr = kwh => (ps ? round(kwh * (ps.current?.value ?? ps.avg)) : null);
  const byId = new Map(rows.map(r => [r.id, r]));
  const dev = id => devices[id] || {};
  const onoff = id => dev(id).capabilitiesObj?.onoff?.value;
  const actions = [];

  // 1. Når ingen er hjemme: målte, ikke-kritiske enheter som står på.
  const switchable = rows.filter(r => usable(r, devices, now) && r.power.value >= 5 && SWITCHABLE.has(dev(r.id).class) && !CRITICAL_NAME.test(r.name) && onoff(r.id) === true)
    .sort((a, b) => b.power.value - a.power.value);
  if (switchable.length) {
    const watts = switchable.reduce((s, r) => s + r.power.value, 0);
    const away = presence.known && !presence.anyoneHome;
    actions.push({
      id: 'away-off', kind: 'away', urgent: away,
      title: away ? 'Ingen er hjemme – dette står på nå' : 'Slå av når huset er tomt',
      why: away
        ? `Ingen i familien er på hjemmenettet, men ${switchable.length} enheter trekker ${round(watts, 0)} W.`
        : `${switchable.length} ikke-kritiske enheter trekker ${round(watts, 0)} W nå. Når alle har gått, kan de slås av.`,
      devices: switchable.map(r => ({ id: r.id, name: r.name, room: r.room, watts: r.power.value })),
      kwhPerHour: round(kwhPerHour(watts), 3), krPerHour: kr(kwhPerHour(watts)),
      flow: `Når: alle i «Hjemme» har forlatt hjemmenettet i 15 min · Så: slå av ${switchable.slice(0, 6).map(r => r.name).join(', ')}${switchable.length > 6 ? ' …' : ''}`
    });
  }

  // 2. Standby: avslåtte enheter som fortsatt trekker strøm.
  const standby = rows.filter(r => usable(r, devices, now) && r.power.value >= 1 && r.power.value < 60 && onoff(r.id) === false && !CRITICAL_NAME.test(r.name))
    .sort((a, b) => b.power.value - a.power.value);
  if (standby.length) {
    const watts = standby.reduce((s, r) => s + r.power.value, 0), perDay = kwhPerHour(watts) * 24;
    actions.push({
      id: 'standby', kind: 'standby',
      title: 'Standby-forbruk på avslåtte enheter',
      why: `${standby.length} enheter er slått av, men trekker til sammen ${round(watts, 1)} W hele døgnet.`,
      devices: standby.map(r => ({ id: r.id, name: r.name, room: r.room, watts: r.power.value })),
      kwhPerDay: round(perDay, 2), krPerDay: ps ? round(perDay * ps.avg) : null,
      flow: 'Bruk en smart stikkontakt som kutter strømmen helt om natten eller når ingen er hjemme.'
    });
  }

  // 3. Flytt fleksibelt forbruk til billige timer.
  if (ps?.best) {
    const saving = ps.current ? ps.current.value - ps.best.mean : ps.avg - ps.best.mean;
    actions.push({
      id: 'shift', kind: 'price', urgent: ps.expensiveNow,
      title: ps.expensiveNow ? 'Strømmen er dyr akkurat nå' : 'Billigste tid i dag',
      why: `Billigste 3 timer videre i dag er ${clock(ps.best.start)}–${clock(ps.best.end)} med snitt ${round(ps.best.mean, 2)} kr/kWh` +
        (ps.current ? `, mot ${round(ps.current.value, 2)} kr/kWh nå.` : '.'),
      window: ps.best, krPerKwh: saving > 0 ? round(saving, 2) : null,
      flow: `Start oppvask, vask, tørk, varmtvann og elbillading kl. ${clock(ps.best.start)}. Med Homey: «Når klokken er ${clock(ps.best.start)} · Så: slå på …».`
    });
  }

  // 4. Varme når ingen er hjemme (ingen besparelse beregnes: ukjent varmebehov).
  const thermostats = rows.map(r => ({ id: r.id, name: r.name, ...dev(r.id) })).filter(d => Number.isFinite(d.capabilitiesObj?.target_temperature?.value));
  if (thermostats.length) {
    actions.push({
      id: 'heat-away', kind: 'heat',
      title: 'Senk varmen når ingen er hjemme',
      why: `${thermostats.length} ${thermostats.length === 1 ? 'termostat er styrbar' : 'termostater er styrbare'}. Et par grader lavere i tomme timer gir ofte merkbar besparelse, men størrelsen er ikke målt her.`,
      devices: thermostats.map(d => ({ id: d.id, name: d.name, target: d.capabilitiesObj.target_temperature.value })),
      flow: 'Når: alle har forlatt hjemmenettet · Så: senk termostatene 2 °C. Når: noen kommer hjem · Så: sett tilbake.'
    });
  }

  // 5. Største forbrukere akkurat nå (bare til innsikt).
  const big = rows.filter(r => usable(r, devices, now) && r.power.value >= 500 && byId.has(r.id) && !/pulse|hovedmåler|main meter/i.test(r.name))
    .sort((a, b) => b.power.value - a.power.value).slice(0, 5);
  if (big.length) {
    actions.push({
      id: 'big', kind: 'insight',
      title: 'Største forbrukere akkurat nå',
      why: `Disse trekker mest nå. Sjekk om noe av det kan vente til billigere timer.`,
      devices: big.map(r => ({ id: r.id, name: r.name, room: r.room, watts: r.power.value }))
    });
  }

  const value = a => a.krPerHour ?? (a.krPerDay != null ? a.krPerDay / 24 : 0);
  return actions.sort((a, b) => (b.urgent === true) - (a.urgent === true) || value(b) - value(a));
}

function clock(t) { return new Date(t).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }); }
