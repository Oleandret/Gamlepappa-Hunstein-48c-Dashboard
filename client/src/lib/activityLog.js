import { useEffect, useState } from 'react';

/**
 * In-memory activity log with pub/sub. Components can push events from
 * anywhere (button clicks, polling diff, flow runs) and the panel
 * subscribes for live updates.
 */

const MAX_ENTRIES = 100;
const log = [];
const listeners = new Set();

let _id = 0;

export function pushEvent({ type = 'info', text, icon, source }) {
  const entry = {
    id: ++_id,
    ts: Date.now(),
    type,
    text,
    icon,
    source
  };
  log.unshift(entry);
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
  for (const fn of listeners) fn(log);
  return entry;
}

export function getLog() {
  return log.slice();
}

export function useActivityLog() {
  const [entries, setEntries] = useState(getLog);
  useEffect(() => {
    const fn = (next) => setEntries(next.slice());
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return entries;
}

/** Diff two device snapshots and emit events for state changes worth logging. */
export function diffDevicesAndLog(prev, next, zonesById = {}) {
  if (!prev || !next) return;
  const prevIds = Object.keys(prev);
  let count = 0;
  for (const id of prevIds) {
    const a = prev[id];
    const b = next[id];
    if (!b) continue;
    const ac = a?.capabilities || {};
    const bc = b?.capabilities || {};
    const zoneName = zonesById[b.zone]?.name;
    // onoff
    if (ac.onoff !== bc.onoff && bc.onoff !== undefined) {
      pushEvent({
        type: bc.onoff ? 'on' : 'off',
        text: `${b.name}${zoneName ? ` (${zoneName})` : ''} ble slått ${bc.onoff ? 'på' : 'av'}`,
        source: 'sync'
      });
      if (++count > 8) return;  // throttle so we don't flood on full first sync
    }
    // locked
    if (ac.locked !== bc.locked && bc.locked !== undefined) {
      pushEvent({
        type: 'security',
        text: `${b.name} ble ${bc.locked ? 'låst' : 'låst opp'}`,
        source: 'sync'
      });
      if (++count > 8) return;
    }
    // alarm transitions
    for (const cap of ['alarm_motion', 'alarm_contact', 'alarm_smoke', 'alarm_water']) {
      if (ac[cap] !== bc[cap] && bc[cap] === true) {
        pushEvent({
          type: 'alarm',
          text: `⚠ ${capLabel(cap)} — ${b.name}`,
          source: 'sync'
        });
        if (++count > 8) return;
      }
    }
  }
}

function capLabel(cap) {
  return ({
    alarm_motion: 'Bevegelse',
    alarm_contact: 'Åpen kontakt',
    alarm_smoke: 'RØYK',
    alarm_water: 'LEKKASJE'
  })[cap] || cap;
}
