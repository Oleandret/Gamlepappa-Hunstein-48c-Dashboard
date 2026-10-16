import { useRef, useState } from 'react';

export function useDeviceCommand() {
  const busy = useRef(false);
  const [status, setStatus] = useState({ pending: false, error: false, text: '' });
  async function run(operation) {
    if (busy.current) return { ok: false, error: 'En kommando behandles allerede' };
    busy.current = true;
    setStatus({ pending: true, error: false, text: 'Sender …' });
    try {
      const result = await operation();
      if (result?.ok === false) throw new Error(result.error || 'Styringen feilet');
      setStatus({ pending: false, error: false, text: result?.warning || (result?.confirmed ? 'Nivå/tilstand bekreftet' : 'Mottatt – venter på bekreftet tilstand') });
      return result;
    } catch (error) {
      setStatus({ pending: false, error: true, text: error.message });
      return { ok: false, error: error.message };
    } finally { busy.current = false; }
  }
  return { ...status, run };
}

export function DeviceCommandStatus({ command }) {
  if (!command.text) return null;
  return <p role={command.error ? 'alert' : 'status'} className={`text-xs ${command.error ? 'text-nx-red' : 'text-nx-mute'}`}>{command.text}</p>;
}
