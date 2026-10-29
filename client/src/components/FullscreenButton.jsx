import { Maximize2, Minimize2 } from 'lucide-react';

/** Fullskjerm-knapp nede til høyre i skjermbildet; brukes av både Mac- og iPhone-skjermen. */
export function FullscreenButton({ full, onToggle }) {
  return (
    <button type="button" onClick={onToggle} onPointerDown={ev => ev.stopPropagation()} title={full ? 'Avslutt fullskjerm (Esc)' : 'Fullskjerm'} aria-label={full ? 'Avslutt fullskjerm' : 'Fullskjerm'}
      className="absolute right-2 bottom-2 rounded-md border border-nx-line/60 bg-nx-bg/70 p-1.5 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/50 backdrop-blur-sm">
      {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </button>
  );
}
