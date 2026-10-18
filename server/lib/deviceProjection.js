// Pairing and driver settings can contain credentials; capability metadata is retained.
export function publicDevices(devices) {
  return Object.fromEntries(Object.entries(devices).map(([id, device]) => {
    if (!device || typeof device !== 'object') return [id, device];
    const {data, settings, settingsObj, ...visible} = device;
    return [id, visible];
  }));
}
