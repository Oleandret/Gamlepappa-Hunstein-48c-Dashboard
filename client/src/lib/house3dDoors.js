import { useCallback, useEffect, useState } from 'react';
import { capValue, hasCap } from './deviceUtils.js';
import { useServerSyncedState } from './useServerSyncedState.js';
import { DOOR_META_URL } from './house3dModel.js';

/**
 * Dører i 3D-modellen og koblingen mot dør-/portsensorer i Homey.
 *
 * Dørmetadata (hengsel, åpningsbevegelse, navn) genereres fra BIM-modellen og
 * ligger i public/models/hunstein48c.doors.json. Koblingen lagres i config-
 * namespacet `house3dDoors`: { [doorId]: deviceId | null } (null = bevisst
 * uten sensor). Dører uten manuell kobling kobles automatisk, i denne
 * rekkefølgen: garasjeport-enhet → pin på 2D-plantegning nær døra → navn.
 */

export function useDoorMeta() {
  const [doors, setDoors] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch(DOOR_META_URL)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setDoors(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return doors;
}

export function useHouse3dDoors() {
  const [config, setConfig, sync] = useServerSyncedState('house3dDoors', {});
  const clean = config && typeof config === 'object' ? config : {};
  const link = useCallback((doorId, deviceId) => {
    setConfig(prev => ({ ...(prev || {}), [doorId]: deviceId ?? null }));
  }, [setConfig]);
  const reset = useCallback((doorId) => {
    setConfig(prev => {
      const next = { ...(prev || {}) };
      delete next[doorId];
      return next;
    });
  }, [setConfig]);
  return { config: clean, link, reset, sync };
}

export function isDoorSensor(d) {
  return Boolean(d) && (hasCap(d, 'alarm_contact') || hasCap(d, 'garagedoor_closed') || d.class === 'garagedoor');
}

/** true = åpen, false = lukket, null = ukjent. */
export function doorSensorOpen(d) {
  if (!d) return null;
  if (hasCap(d, 'garagedoor_closed')) {
    const v = capValue(d, 'garagedoor_closed');
    return typeof v === 'boolean' ? !v : null;
  }
  if (hasCap(d, 'alarm_contact')) {
    const v = capValue(d, 'alarm_contact');
    return typeof v === 'boolean' ? v : null;
  }
  return null;
}

const DOORISH = /d[øo]r|port|door|skyve|garasje/i;

/**
 * Finner sensor per dør. Returnerer { links: {doorId: deviceId|null}, source: {doorId: tekst} }.
 * `markers` er pins fra 2D-plantegningene i verdenskoordinater ({floorId, x, z, device}).
 */
export function resolveDoorLinks(doors, devices, manual, markers) {
  const links = {};
  const source = {};
  const used = new Set();
  const devs = devices || {};

  for (const d of doors) {
    if (!Object.prototype.hasOwnProperty.call(manual || {}, d.id)) continue;
    const id = manual[d.id];
    links[d.id] = id && devs[id] ? id : null;
    source[d.id] = id ? 'manuell' : 'manuell: ingen sensor';
    if (id) used.add(id);
  }

  const sensors = Object.values(devs).filter(s => isDoorSensor(s) && !used.has(s.id));
  const free = (d) => !(d.id in links);

  const garage = doors.find(d => d.kind === 'garage');
  if (garage && free(garage)) {
    const g = sensors.find(s => s.class === 'garagedoor' || hasCap(s, 'garagedoor_closed'))
      || sensors.find(s => /garasje\s*port|garasjed[øo]r|garage/i.test(s.name || ''));
    if (g) { links[garage.id] = g.id; used.add(g.id); source[garage.id] = 'auto: garasjeport-enhet'; }
  }

  for (const m of markers || []) {
    if (!isDoorSensor(m.device) || used.has(m.device.id)) continue;
    let best = null;
    let bestDist = 1.5;
    for (const d of doors) {
      if (d.floor !== m.floorId || !free(d)) continue;
      const dist = Math.hypot(d.center[0] - m.x, d.center[2] - m.z);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (best) {
      links[best.id] = m.device.id; used.add(m.device.id);
      source[best.id] = `auto: pin ${bestDist.toFixed(1)} m fra døra`;
    }
  }

  for (const s of sensors) {
    if (used.has(s.id)) continue;
    const name = (s.name || '').toLowerCase();
    if (!DOORISH.test(name)) continue;
    let best = null;
    let bestLen = 0;
    let tie = false;
    for (const d of doors) {
      if (!free(d)) continue;
      for (const k of d.keywords || []) {
        if (!k || !name.includes(k)) continue;
        if (k.length > bestLen) { bestLen = k.length; best = d; tie = false; }
        else if (k.length === bestLen && best !== d) tie = true;
      }
    }
    if (best && !tie) { links[best.id] = s.id; used.add(s.id); source[best.id] = 'auto: navn'; }
  }

  return { links, source };
}
