// Pure normalization of myUplink ParameterData points (public-v2 contract:
// category, parameterId, parameterName, parameterUnit, timestamp, value, strVal,
// smartHomeCategories, writable). No network, no device control.
// A kWh point is not split into heat vs electricity and no COP is derived here:
// the contract does not say which side of the heat pump a point belongs to.
export const DEFAULT_MAX_AGE_MS = 900_000;
export const MAX_POINTS = 1000;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => (typeof value === 'string' && value.trim() ? value : null);

function toMs(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (finite(value)) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function identify(point) {
  if (text(point.parameterId)) return point.parameterId;
  if (finite(point.parameterId)) return String(point.parameterId);
  return null;
}

// NaN, Infinity, objects and arrays are unusable readings, never 0 and never a label.
function readValue(raw) {
  if (raw === null || raw === undefined) return { value: null, valueType: null };
  if (typeof raw === 'boolean' || typeof raw === 'string') return { value: raw, valueType: typeof raw };
  if (finite(raw)) return { value: raw, valueType: 'number' };
  return { value: null, valueType: null };
}

export function normalizeHeatingPoints(points, options = {}) {
  const { fetchedAt, now = Date.now() } = options;
  const maxAgeMs = finite(options.maxAgeMs) && options.maxAgeMs > 0 ? options.maxAgeMs : DEFAULT_MAX_AGE_MS;
  const list = Array.isArray(points) ? points : [];
  const truncated = list.length > MAX_POINTS;
  const normalized = [];
  let skipped = 0;
  for (const point of list.slice(0, MAX_POINTS)) {
    if (!point || typeof point !== 'object' || Array.isArray(point)) { skipped++; continue; }
    const id = identify(point);
    if (!id) { skipped++; continue; }
    const { value, valueType } = readValue(point.value);
    // measuredAt is the point's own timestamp. fetchedAt only says when we asked.
    const measuredAt = toMs(point.timestamp);
    const quality = value === null ? 'missing'
      : measuredAt === null ? 'unknown-time'
      : measuredAt > now || now - measuredAt > maxAgeMs ? 'stale'
      : 'measured';
    normalized.push({
      id,
      name: text(point.parameterName),
      unit: text(point.parameterUnit),
      category: text(point.category),
      value,
      valueType,
      enumLabel: text(point.enumLabel),
      invalidSentinel: value === -32768,
      strVal: typeof point.strVal === 'string' ? point.strVal : null,
      measuredAt,
      quality,
      // Upstream metadata only. This is not authorization to write anything.
      writableUpstream: point.writable === true
    });
  }
  return { fetchedAt: toMs(fetchedAt), maxAgeMs, points: normalized, skipped, truncated };
}
