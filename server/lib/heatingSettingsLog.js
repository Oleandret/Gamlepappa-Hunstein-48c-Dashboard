// Daily record of how the heat pump is set: one file per Oslo date holding every
// writable point as it stood at the last read that day, plus an append-only change
// log of every setting change made from the dashboard. Files are private (0600/0700).
import fs from 'node:fs/promises';
import path from 'node:path';
import { osloDate } from './energyReader.js';

const DAY = /^settings-(\d{4}-\d{2}-\d{2})\.json$/;
const SETTING_FIELDS = ['parameterId', 'parameterName', 'parameterUnit', 'category', 'value', 'strVal', 'enumLabel', 'minValue', 'maxValue', 'stepValue', 'enumValues'];

export function settingsOf(points) {
  return (Array.isArray(points) ? points : []).filter(p => p?.writable === true && p.parameterId != null).slice(0, 1000)
    .map(p => Object.fromEntries(SETTING_FIELDS.filter(k => p[k] !== undefined).map(k => [k, k === 'parameterId' ? String(p[k]) : p[k]])));
}
const fingerprint = settings => JSON.stringify(settings.map(s => [s.parameterId, s.value]).sort());

export function createHeatingSettingsLog({ dir, now = Date.now, retentionDays = 800, maxChanges = 5000 }) {
  let queue = Promise.resolve();
  const serial = fn => { const t = queue.catch(() => {}).then(fn); queue = t; return t; };
  async function ready() {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Settings directory must be private');
  }
  async function writeFile(name, data) {
    const tmp = path.join(dir, `.${name}.tmp`), dest = path.join(dir, name);
    const fd = await fs.open(tmp, 'w', 0o600);
    try { await fd.writeFile(data); await fd.sync(); } finally { await fd.close(); }
    await fs.rename(tmp, dest);
  }
  async function readJson(name) {
    try { return JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }

  // Called after each successful read. Only rewrites today's file when a setting changed.
  function record(sample, identity) {
    return serial(async () => {
      if (sample?.status !== 'ok' || !identity?.deviceId) return null;
      const settings = settingsOf(sample.points);
      if (!settings.length) return null;
      await ready();
      const date = osloDate(now()), name = `settings-${date}.json`, previous = await readJson(name);
      if (previous && previous.deviceId === identity.deviceId && fingerprint(previous.settings) === fingerprint(settings)) return { date, changed: false };
      await writeFile(name, JSON.stringify({ version: 1, date, deviceId: identity.deviceId, systemId: identity.systemId, recordedAt: new Date(now()).toISOString(), settings }));
      const cutoff = osloDate(now() - retentionDays * 86400000);
      for (const f of await fs.readdir(dir)) { const m = DAY.exec(f); if (m && m[1] < cutoff) await fs.unlink(path.join(dir, f)); }
      return { date, changed: true };
    });
  }
  async function days() {
    try { return (await fs.readdir(dir)).map(f => DAY.exec(f)?.[1]).filter(Boolean).sort().reverse(); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  }
  async function day(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
    return readJson(`settings-${date}.json`);
  }
  const changeFile = 'changes.jsonl';
  function append(entry) {
    return serial(async () => {
      await ready();
      const fd = await fs.open(path.join(dir, changeFile), 'a', 0o600);
      try { await fd.appendFile(JSON.stringify(entry) + '\n'); await fd.sync(); } finally { await fd.close(); }
    });
  }
  async function changes(limit = 100) {
    let text = '';
    try { text = await fs.readFile(path.join(dir, changeFile), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const lines = text.split('\n').filter(Boolean);
    return lines.slice(-Math.min(limit, maxChanges)).reverse().flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
  }
  return { record, days, day, append, changes };
}

// What would change if a historic day were restored: only settings that differ now.
export function diffSettings(snapshot, currentPoints) {
  const current = new Map((currentPoints || []).map(p => [String(p.parameterId), p]));
  return (snapshot?.settings || []).flatMap(s => {
    const now = current.get(s.parameterId);
    if (!now) return [{ ...s, current: null, restorable: false, reason: 'Finnes ikke lenger' }];
    if (String(now.value) === String(s.value)) return [];
    return [{ ...s, current: now.value, currentLabel: now.enumLabel ?? null, restorable: now.writable === true }];
  });
}
