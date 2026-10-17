export async function fetchJson(url, options = {}, { timeoutMs = 15000, maxBytes = 2_000_000, fetchImpl = fetch } = {}) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const response = await fetchImpl(url, { ...options, signal, redirect: 'error' });
  if (!response.ok) {
    const retry = response.headers.get('Retry-After');
    const seconds = retry === null ? NaN : Number(retry);
    const retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retry) - Date.now());
    throw Object.assign(new Error(`Upstream HTTP ${response.status}`), { upstreamStatus: response.status, retryAfterMs });
  }
  if (response.status === 204) return null;
  let size = 0, text = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Upstream response too large');
    text += decoder.decode(chunk,{stream:true});
  }
  return JSON.parse(text + decoder.decode());
}
