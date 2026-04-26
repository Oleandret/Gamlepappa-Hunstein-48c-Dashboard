import { useEffect, useState } from 'react';
import { Save, Check, AlertCircle, Loader } from 'lucide-react';

/**
 * Gjenbrukbar 'Lagre til server'-knapp. Tar et `sync`-objekt fra
 * useServerSyncedState ({ saving, lastSavedAt, error, flush }).
 *
 * Auto-save skjer 500ms etter siste endring uansett, men knappen tvinger
 * fram en umiddelbar PUT og gir visuell bekreftelse.
 *
 * Status-tilstander:
 *   normal    — "Lagre til server"
 *   saving    — "Lagrer..."  (med spinner)
 *   saved     — "Lagret ✓"   (i 2.5 sekunder etter vellykket save)
 *   error     — "Feil!"      (rød)
 */
export function SaveButton({ sync, label = 'Lagre til server', size = 'md', className = '' }) {
  const { saving, lastSavedAt, error, flush } = sync || {};
  const [showSavedFor, setShowSavedFor] = useState(null);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSavedFor(lastSavedAt);
    const t = setTimeout(() => setShowSavedFor(null), 2500);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  const isJustSaved = showSavedFor === lastSavedAt && lastSavedAt;
  const tone = error ? 'red' : isJustSaved ? 'green' : 'cyan';

  let text = label;
  let Icon = Save;
  if (saving) { text = 'Lagrer...'; Icon = Loader; }
  else if (isJustSaved) { text = 'Lagret'; Icon = Check; }
  else if (error) { text = 'Feil — prøv igjen'; Icon = AlertCircle; }

  const colorClass = tone === 'red'
    ? 'border-nx-red/55 text-nx-red bg-nx-red/10'
    : tone === 'green'
    ? 'border-nx-green/55 text-nx-green bg-nx-green/10'
    : 'border-nx-line/60 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/40';

  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]';

  return (
    <button
      type="button"
      onClick={() => flush?.().catch(() => {})}
      disabled={saving}
      className={[
        'inline-flex items-center gap-1.5 rounded-md font-mono uppercase tracking-[0.18em] transition-colors border',
        sizeClass,
        colorClass,
        saving ? 'opacity-70 cursor-wait' : '',
        className
      ].join(' ')}
      title={error ? `Feil: ${error.message || 'ukjent'}` : 'Tving lagring til server nå'}
    >
      <Icon size={11} aria-hidden="true" className={saving ? 'animate-spin' : ''} />
      {text}
    </button>
  );
}
