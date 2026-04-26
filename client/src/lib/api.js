const BASE = import.meta.env.VITE_API_BASE || '';

async function jget(path, signal) {
  const r = await fetch(`${BASE}/api${path}`, { signal });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

async function jpost(path, body) {
  const r = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `${path} → ${r.status}`);
  }
  return r.json();
}

export const api = {
  systemInfo: (signal) => jget('/system/info', signal),
  zones:      (signal) => jget('/homey/zones', signal),
  devices:    (signal) => jget('/homey/devices', signal),
  flows:      (signal) => jget('/homey/flows', signal),
  energy:     (signal) => jget('/homey/energy', signal),
  activity:   (signal) => jget('/homey/activity', signal),
  security:   (signal) => jget('/homey/security', signal),
  weather:    (signal) => jget('/weather', signal),
  inventory:  (signal, full = false) => jget(`/homey/inventory${full ? '?full=true' : ''}`, signal),
  setCapability: (deviceId, capability, value) =>
    jpost(`/homey/devices/${encodeURIComponent(deviceId)}/capability/${encodeURIComponent(capability)}`, { value }),
  runFlow: (flowId) =>
    jpost(`/homey/flows/${encodeURIComponent(flowId)}/run`),

  // Config-store: server-persistert bruker-config per namespace
  config: {
    getAll: (signal) => jget('/config', signal),
    get: (ns, signal) => jget(`/config/${encodeURIComponent(ns)}`, signal),
    put: (ns, value) => fetch(`${BASE}/api/config/${encodeURIComponent(ns)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    }).then(r => {
      if (!r.ok) throw new Error(`PUT /config/${ns} → ${r.status}`);
      return r.json();
    }),
    del: (ns) => fetch(`${BASE}/api/config/${encodeURIComponent(ns)}`, {
      method: 'DELETE'
    }).then(r => {
      if (!r.ok) throw new Error(`DELETE /config/${ns} → ${r.status}`);
      return r.json();
    })
  }
};
