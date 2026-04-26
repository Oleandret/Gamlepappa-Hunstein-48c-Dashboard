import { useEffect, useState } from 'react';

/**
 * Jarvis-aktig AI Connection-indikator. Sjekker om ElevenLabs ConvAI sitt
 * custom-element er registrert i window.customElements (dvs. at loader-scriptet
 * fra index.html har lastet og initialisert seg). Lytter også på
 * `elevenlabs-convai:call`-event som widgeten dispatcher når den starter en
 * sesjon, slik at vi kan vise et "AKTIV"-state med raskere animasjon.
 */
export function AIConnection() {
  const [registered, setRegistered] = useState(false);
  const [active, setActive] = useState(false);

  // Polle for at custom-element-et er registrert. Stopp så snart vi ser det.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      if (window.customElements?.get('elevenlabs-convai')) {
        setRegistered(true);
      } else {
        setTimeout(check, 600);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  // Lytt på samtale-events fra widgeten
  useEffect(() => {
    const onCall = () => {
      setActive(true);
      // Vi har ingen pålitelig "session ended"-event på document level,
      // så vi resetter etter en kort delay. Hvis du vil ha en mer presis
      // statushåndtering, må vi plugge inn på `client-tools` eller
      // `transcript`-events i widgeten.
      setTimeout(() => setActive(false), 90 * 1000);
    };
    document.addEventListener('elevenlabs-convai:call', onCall);
    return () => document.removeEventListener('elevenlabs-convai:call', onCall);
  }, []);

  const status = !registered ? 'tilkobler' : active ? 'aktiv' : 'online';
  const accent = !registered ? 'amber' : active ? 'purple' : 'cyan';

  return (
    <div
      className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.20em]"
      role="status"
      aria-label={`AI connection ${status}`}
    >
      <Equalizer active={registered} fast={active} accent={accent} />
      <span className="text-nx-mute">AI CONNECTION</span>
      <span className="text-nx-line">·</span>
      <span className={accentTextClass(accent) + ' inline-flex items-center gap-1'}>
        <span className={['h-1.5 w-1.5 rounded-full animate-pulseGlow', accentBgClass(accent)].join(' ')} />
        {status}
      </span>
    </div>
  );
}

function Equalizer({ active, fast, accent }) {
  // 5 bars med litt forskjellige høyder + delays for organisk effekt
  const heights = ['40%', '70%', '100%', '60%', '85%'];
  const delays  = ['0ms', '120ms', '240ms', '360ms', '480ms'];
  const colorClass = accentBgClass(accent);
  const duration = fast ? '0.55s' : '0.9s';

  return (
    <div className="flex items-end gap-[2px] h-3 w-7" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={[
            'w-[2px] rounded-sm origin-bottom',
            active ? colorClass : 'bg-nx-mute',
            active ? 'animate-equalizer' : ''
          ].join(' ')}
          style={{
            height: active ? h : '20%',
            animationDelay: active ? delays[i] : undefined,
            animationDuration: active ? duration : undefined
          }}
        />
      ))}
    </div>
  );
}

function accentTextClass(a) {
  return a === 'purple' ? 'text-nx-purple'
       : a === 'amber'  ? 'text-nx-amber'
       : 'text-nx-cyan';
}
function accentBgClass(a) {
  return a === 'purple' ? 'bg-nx-purple'
       : a === 'amber'  ? 'bg-nx-amber'
       : 'bg-nx-cyan';
}
