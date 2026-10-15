export function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }
export const capValue = (d, cap) => d?.capabilitiesObj?.[cap]?.value ?? (!Array.isArray(d?.capabilities) ? d?.capabilities?.[cap] : undefined);
export function hasCap(d, cap) { return Boolean(d?.capabilitiesObj?.[cap]) || (Array.isArray(d?.capabilities) ? d.capabilities.includes(cap) : Object.hasOwn(d?.capabilities || {}, cap)); }
export function validateCapability(devices, id, cap, value) {
  const device = devices?.[id] || Object.values(devices || {}).find(d => d.id === id);
  if (!device || device.available === false || !hasCap(device, cap)) throw invalid('Enhet eller capability er utilgjengelig');
  const meta = device.capabilitiesObj?.[cap] || {};
  if (meta.setable === false || cap.startsWith('measure_') || cap.startsWith('meter_') || cap.startsWith('alarm_')) throw invalid('Capability er skrivebeskyttet');
  const current = capValue(device, cap);
  const type = meta.type || typeof current;
  if (type === 'enum') {
    if (!meta.values?.some(v => (v.id ?? v) === value)) throw invalid('Ugyldig enum-verdi');
  } else if (!['boolean','number','string'].includes(typeof value) || (type !== 'undefined' && typeof value !== type)) throw invalid('Feil datatype');
  if (typeof value === 'number') {
    const min = meta.min ?? (['dim','volume_set','windowcoverings_set','light_hue','light_saturation'].includes(cap) ? 0 : undefined);
    const max = meta.max ?? (['dim','volume_set','windowcoverings_set','light_hue','light_saturation'].includes(cap) ? 1 : undefined);
    if (!Number.isFinite(value) || (min != null && value < min) || (max != null && value > max)) throw invalid('Verdi utenfor tillatt område');
  }
  if (typeof value === 'string' && value.length > 256) throw invalid('Verdien er for lang');
  return device;
}
export function validateFlow(flow, devices, flows = {}) {
  const t = flow?.trigger;
  if (t?.type !== 'device_change' || !hasCap(devices?.[t.deviceId], t.capability) || !['changes','equals','becomes_true','becomes_false'].includes(t.condition)) throw invalid('Ugyldig trigger');
  if (t.condition === 'equals' && !['boolean','number','string'].includes(typeof t.value)) throw invalid('Trigger mangler verdi');
  if (!Array.isArray(flow.actions) || !flow.actions.length || flow.actions.length > 20) throw invalid('Flow må ha 1–20 handlinger');
  for (const a of flow.actions) {
    if (a.type === 'set_capability') validateCapability(devices, a.deviceId, a.capability, a.value);
    else if (a.type !== 'run_flow' || !flows[a.flowId]) throw invalid('Ugyldig handling eller flow');
  }
  return flow;
}
export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) throw invalid('Send 1–40 meldinger');
  // Client history is untrusted. Never forward privileged roles or fabricated tool results.
  return messages.map(m => {
    if (!['user','assistant'].includes(m?.role) || typeof m.content !== 'string' || m.content.length > 12000) throw invalid('Ugyldig melding');
    return { role: m.role, content: m.content };
  });
}
