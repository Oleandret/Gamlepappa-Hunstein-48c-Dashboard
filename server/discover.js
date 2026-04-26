#!/usr/bin/env node
/**
 * Gamlepappa Smarthus Discovery — dump full Homey inventory to a local JSON file.
 *
 * Run from the project root:
 *
 *   HOMEY_PAT=<din PAT> node server/discover.js
 *
 * or, with the PAT already in server/config.js:
 *
 *   node server/discover.js
 *
 * Output:
 *   - homey-inventory.json   (full structured inventory)
 *   - prints a summary to stdout
 *
 * Share the JSON file with Claude in chat to get a custom-tailored dashboard.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { homeyClient, isConfigured } from './lib/homeyClient.js';
import { buildInventory } from './lib/inventory.js';

const OUTPUT = 'homey-inventory.json';

async function main() {
  if (!isConfigured()) {
    console.error('\n  ✗ HOMEY_PAT mangler. Sett env-variabel eller fyll inn server/config.js.\n');
    process.exit(1);
  }

  console.log('\n  ⚡  Gamlepappa Smarthus Discovery — leser Homey...\n');
  const t0 = Date.now();

  const [devices, zones, flows] = await Promise.all([
    homeyClient.listDevices(),
    homeyClient.listZones(),
    homeyClient.listFlows()
  ]);

  const inventory = buildInventory({ devices, zones, flows });
  inventory.raw = { devices, zones, flows };  // include raw data for full custom tuning

  writeFileSync(OUTPUT, JSON.stringify(inventory, null, 2), 'utf8');

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const s = inventory.summary;

  console.log(`  ✓  Lest ${s.devices} enheter, ${s.zones} rom, ${s.flows} flows på ${dt}s\n`);

  console.log('  ── Topp 10 device-klasser ──');
  inventory.classes.slice(0, 10).forEach(c => console.log(`     ${pad(c.class, 22)} ${c.count}`));

  console.log('\n  ── Topp 10 capabilities ──');
  inventory.capabilities.slice(0, 10).forEach(c => console.log(`     ${pad(c.capability, 28)} ${c.count}`));

  console.log('\n  ── Rom (sortert etter antall enheter) ──');
  inventory.zones.slice(0, 15).forEach(z => console.log(`     ${pad(z.name, 22)} ${z.deviceCount}`));

  console.log('\n  ── Feature-flagg ──');
  Object.entries(inventory.featureFlags).forEach(([k, v]) => {
    console.log(`     ${pad(k, 18)} ${v ? '✓' : '·'}`);
  });

  if (inventory.specialDevices.length) {
    console.log(`\n  ── ${inventory.specialDevices.length} spesielle enheter (uvanlig klasse — kan trenge egne widgets) ──`);
    inventory.specialDevices.slice(0, 10).forEach(d =>
      console.log(`     ${pad(d.name || d.id, 30)} class=${d.class}`)
    );
    if (inventory.specialDevices.length > 10) {
      console.log(`     ... og ${inventory.specialDevices.length - 10} til (se ${OUTPUT})`);
    }
  }

  console.log(`\n  ✅  Skrev ${OUTPUT}\n`);
  console.log('  Neste steg: del filen med Claude i chatten for skreddersydd dashboard.\n');
}

function pad(s, n) {
  s = String(s);
  return s + ' '.repeat(Math.max(0, n - s.length));
}

main().catch(err => {
  console.error('\n  ✗  Feil:', err.message, '\n');
  process.exit(1);
});
