// Avspiller for Mac-agentens videostrøm: H.264 som fragmentert MP4 over én lang HTTP-strøm
// (/iphone/api/mac/video), spilt med Media Source Extensions. Bytene legges i en SourceBuffer
// etter hvert som de kommer, og spilleren holdes helt i enden av bufferen så hvert bilde vises
// idet det kommer. Samme logikk som public/fmp4.js i iphone-remote.

/** Kodek-streng («avc1.PPCCLL») fra init-segmentet: boksen avcC har versjon, profil, kompatibilitet og nivå. */
export function codecsFromInit(bytes) {
  for (let i = 0; i + 8 <= bytes.length; i++) {
    if (bytes[i] === 0x61 && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x63 && bytes[i + 3] === 0x43) {
      const h = v => v.toString(16).toUpperCase().padStart(2, '0');
      return `avc1.${h(bytes[i + 5])}${h(bytes[i + 6])}${h(bytes[i + 7])}`;
    }
  }
  return null;
}

/** Antall bilder (moof-bokser) i en bit av strømmen; brukes bare til statistikk. */
export function countFragments(bytes) {
  let n = 0;
  for (let i = 0; i + 8 <= bytes.length; i++) if (bytes[i] === 0x6d && bytes[i + 1] === 0x6f && bytes[i + 2] === 0x6f && bytes[i + 3] === 0x66) n++;
  return n;
}

export const concatBytes = parts => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export const mseSupported = () => typeof window !== 'undefined' && !!(window.ManagedMediaSource || window.MediaSource);

/**
 * Starter avspilling i `video` fra `url`. Returnerer { stop }. onError kalles én gang ved feil
 * (nettleseren støtter ikke MSE, strømmen brytes, kodeken avvises); onStats med { fps, kbps } hvert 2. sekund.
 */
export function createFmp4Player(video, url, { onError = () => {}, onStats = () => {}, fetchInit = {} } = {}) {
  const MS = typeof window !== 'undefined' ? (window.ManagedMediaSource || window.MediaSource) : null;
  if (!MS || typeof MS.isTypeSupported !== 'function') { setTimeout(() => onError(new Error('Nettleseren støtter ikke MSE')), 0); return { stop() {} }; }
  const ctrl = new AbortController();
  const ms = new MS();
  let sb = null, pending = [], head = [], headLen = 0, stopped = false, frames = 0, bytes = 0, since = Date.now();
  const stop = () => { if (stopped) return; stopped = true; ctrl.abort(); try { video.pause(); } catch {} try { video.removeAttribute('src'); video.srcObject = null; video.load(); } catch {} };
  const fail = e => { if (stopped) return; stop(); onError(e); };
  const live = () => {
    const b = video.buffered; if (!b.length) return;
    const start = b.start(b.length - 1), end = b.end(b.length - 1);
    if (video.currentTime < start || video.currentTime < end - 0.5) video.currentTime = Math.max(start, end - 0.08);
    if (video.paused) video.play().catch(() => {});
  };
  const pump = () => {
    if (!sb || sb.updating || stopped) return;
    if (pending.length) { const chunk = pending.length === 1 ? pending[0] : concatBytes(pending); pending = []; try { sb.appendBuffer(chunk); } catch (e) { fail(e); } return; }
    const b = sb.buffered; if (b.length && b.end(b.length - 1) - b.start(0) > 30) { try { sb.remove(b.start(0), b.end(b.length - 1) - 10); } catch {} }
  };
  ms.addEventListener('sourceopen', async () => {
    try {
      const res = await fetch(url, { ...fetchInit, cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(`video: ${res.status}`);
      const reader = res.body.getReader();
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) throw new Error('videostrømmen ble brutt');
        bytes += value.length; frames += countFragments(value);
        if (!sb) {
          head.push(value); headLen += value.length;
          const h = concatBytes(head); const codecs = codecsFromInit(h);
          if (!codecs) { if (headLen > 1 << 16) throw new Error('fant ikke avcC i strømmen'); continue; }
          const mime = `video/mp4; codecs="${codecs}"`;
          if (!MS.isTypeSupported(mime)) throw new Error(`nettleseren kan ikke spille ${mime}`);
          sb = ms.addSourceBuffer(mime); sb.mode = 'segments';
          sb.addEventListener('updateend', () => { live(); pump(); });
          sb.addEventListener('error', () => fail(new Error('SourceBuffer-feil')));
          pending.push(h); head = [];
        } else pending.push(value);
        pump();
        const dt = Date.now() - since;
        if (dt >= 2000) { onStats({ fps: Math.round(frames * 1000 / dt), kbps: Math.round(bytes * 8 / dt) }); frames = 0; bytes = 0; since = Date.now(); }
      }
    } catch (e) { if (!stopped) fail(e); }
  });
  if (window.ManagedMediaSource && ms instanceof window.ManagedMediaSource) { ms.addEventListener('startstreaming', pump); video.disableRemotePlayback = true; video.srcObject = ms; }
  else video.src = URL.createObjectURL(ms);
  video.addEventListener('error', () => fail(new Error('videoelementet feilet')));
  video.muted = true; video.playsInline = true; video.autoplay = true;
  return { stop };
}
