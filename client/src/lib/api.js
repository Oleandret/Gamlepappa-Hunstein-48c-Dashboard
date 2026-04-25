const BASE = import.meta.env.VITE_API_BASE || '';

async function jget(path) {
  const r = await fetch(`${BASE}/api${path}`);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

async function jpost(path, body) {
  const r = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

export const api = {
  systemInfo: () => jget('/system/info'),
  zones: () => jget('/homey/zones'),
  devices: () => jget('/homey/devices'),
  flows: () => jget('/homey/flows'),
  energy: () => jget('/homey/energy'),
  activity: () => jget('/homey/activity'),
  security: () => jget('/homey/security'),
  weather: () => jget('/weather'),
  setCapability: (deviceId, capability, value) =>
    jpost(`/homey/devices/${deviceId}/capability/${capability}`, { value }),
  runFlow: (flowId) => jpost(`/homey/flows/${flowId}/run`)
};
