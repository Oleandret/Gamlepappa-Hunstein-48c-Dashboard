import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Enkel JSON-fil-basert config-store. All brukerkonfig (pins på framsiden,
 * floor plan pins, sensor-widgets, lenker, flow-favoritter, bilde-config)
 * lagres her per namespace.
 *
 * Filsti: process.env.CONFIG_PATH (default: <projektrot>/data/config.json).
 * For persistens på Railway: legg til en Volume og mount den på /data,
 * sett deretter CONFIG_PATH=/data/config.json som env-variabel.
 *
 * Skriver med atomic rename (write to .tmp, deretter rename) så filen
 * aldri blir delvis skrevet hvis prosessen krasjer midt under en write.
 */

const DEFAULT_PATH = path.resolve(process.cwd(), 'data', 'config.json');
const CONFIG_PATH = process.env.CONFIG_PATH || DEFAULT_PATH;

let _cache = null;       // {[namespace]: any}
let _writeQueue = null;  // pending Promise to serialize writes

async function ensureDir() {
  const dir = path.dirname(CONFIG_PATH);
  await fsp.mkdir(dir, { recursive: true });
}

async function load() {
  if (_cache) return _cache;
  try {
    const raw = await fsp.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    _cache = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[configStore] failed to load, starting fresh:', err.message);
    }
    _cache = {};
  }
  return _cache;
}

async function persist() {
  await ensureDir();
  const tmp = CONFIG_PATH + '.tmp';
  const data = JSON.stringify(_cache, null, 2);
  await fsp.writeFile(tmp, data, 'utf8');
  await fsp.rename(tmp, CONFIG_PATH);
}

async function save() {
  // Serialiser writes så vi aldri har to parallelle skriv.
  if (_writeQueue) return _writeQueue;
  _writeQueue = persist().finally(() => { _writeQueue = null; });
  return _writeQueue;
}

export async function getAll() {
  return { ...(await load()) };
}

export async function getNamespace(ns) {
  const all = await load();
  return all[ns];
}

export async function setNamespace(ns, value) {
  await load();
  _cache[ns] = value;
  await save();
  return value;
}

export async function deleteNamespace(ns) {
  await load();
  delete _cache[ns];
  await save();
}

export function configPath() { return CONFIG_PATH; }
