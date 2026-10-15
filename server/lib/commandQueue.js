/**
 * Rate-limitet kommando-kø for skriving til Homey-enheter.
 *
 * Plejd (og andre BLE-mesh-enheter) tåler ikke mange kommandoer på rappen —
 * gateway-en kan henge eller droppe kommandoer hvis den oversvømmes. Denne
 * køen serialiserer ALL skriving (setCapability, runFlow) og sender med et
 * minimum mellomrom, slik at f.eks. "dim alle lys" ikke fyrer 20 BLE-
 * kommandoer på én gang.
 *
 * Standard: maks ~4 kommandoer/sekund (250ms gap). Overstyr med
 * COMMAND_MIN_GAP_MS env-variabel.
 */

const MIN_GAP_MS = Math.max(100, Math.min(10000, Number(process.env.COMMAND_MIN_GAP_MS) || 250));

const queue = [];
let processing = false;
let lastRunAt = 0;
let stats = { queued: 0, executed: 0, failed: 0, maxQueueLen: 0 };

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const gap = Date.now() - lastRunAt;
    if (gap < MIN_GAP_MS) await delay(MIN_GAP_MS - gap);

    const job = queue.shift();
    if (Date.now() - job.enqueuedAt > 30000) { job.reject(new Error('Kommando utløpt i kø')); continue; }
    lastRunAt = Date.now();
    try {
      const result = await job.fn();
      stats.executed++;
      job.resolve(result);
    } catch (err) {
      stats.failed++;
      job.reject(err);
    }
  }
  processing = false;
}

/**
 * Legg en kommando i køen. Returnerer et promise som resolver når kommandoen
 * faktisk er utført (etter rate-limit-ventetid).
 */
export function enqueueCommand(fn, label = 'cmd') {
  if (queue.length >= 50) return Promise.reject(Object.assign(new Error('Kommandokøen er full'), {status:429}));
  stats.queued++;
  return new Promise((resolve, reject) => {
    queue.push({ fn, label, resolve, reject, enqueuedAt:Date.now() });
    stats.maxQueueLen = Math.max(stats.maxQueueLen, queue.length);
    processQueue();
  });
}

export function queueStatus() {
  return {
    pending: queue.length,
    processing,
    minGapMs: MIN_GAP_MS,
    ...stats
  };
}
