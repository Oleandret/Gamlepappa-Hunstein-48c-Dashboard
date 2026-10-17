import { useState } from 'react';

// ElevenLabs-widgeten kjører i /voice/widget i en sandboxed iframe uten
// allow-same-origin (opaque origin): leverandørens skript får mikrofon og nett
// mot ElevenLabs, men ingen tilgang til dashboardets innlogging, lagring eller API.
const AGENTS = {
  oversikt: 'SCOI5nAeUm2P90tPlhxJ',
  standard: 'agent_4501kc02r47xec2s0r87f0awxdj6'
};

export function VoiceAssistant({ section }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  if (section === 'avatar' || section === 'chat') return null;
  const key = section === 'oversikt' ? 'oversikt' : 'standard';
  const side = section === 'hus-3d' ? 'left-24' : 'right-4';
  const toggle = () => { setStarted(true); setOpen(o => !o); };

  return (
    <div className={`fixed bottom-4 ${side} z-50 flex flex-col items-end gap-2`}>
      {started && (
        <div
          className={`${open ? 'flex' : 'hidden'} h-[560px] max-h-[calc(100vh-120px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-nx-cyan/50 bg-nx-bg shadow-glow-soft`}
          role="dialog"
          aria-label="ElevenLabs-taleassistent"
        >
          <div className="flex items-center justify-between border-b border-nx-line/60 px-3 py-2">
            <span className="text-sm text-nx-cyan">ElevenLabs · Taleassistent</span>
            <span className="flex items-center gap-3">
              <a
                href={`https://elevenlabs.io/app/talk-to?agent_id=${AGENTS[key]}`}
                target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                className="text-[10px] font-mono uppercase tracking-[0.16em] text-nx-mute hover:text-nx-cyan"
              >Ny fane ↗</a>
              <button onClick={() => setOpen(false)} aria-label="Skjul taleassistent" className="text-nx-mute hover:text-nx-cyan">✕</button>
            </span>
          </div>
          <iframe
            key={key}
            title="ElevenLabs-taleassistent"
            src={`/voice/widget?agent=${key}`}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            allow="microphone *; autoplay *"
            referrerPolicy="no-referrer"
            className="h-full w-full flex-1 border-0 bg-transparent"
          />
        </div>
      )}
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Skjul taleassistent' : 'Åpne taleassistent'}
        className="flex items-center gap-3 rounded-2xl border border-nx-cyan/50 bg-nx-bg px-4 py-3 shadow-glow-soft hover:border-nx-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-nx-cyan"
      >
        <span aria-hidden="true" className="h-8 w-8 rounded-full bg-gradient-to-br from-nx-cyan to-nx-purple" />
        <span className="text-left">
          <span className="block text-sm text-nx-cyan">ElevenLabs · Taleassistent</span>
          <span className="block text-xs text-nx-mute">{open ? 'Skjul' : 'Snakk her'}</span>
        </span>
      </button>
    </div>
  );
}
