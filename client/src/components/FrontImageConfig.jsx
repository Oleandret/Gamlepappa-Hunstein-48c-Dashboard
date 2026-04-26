import { RotateCcw } from 'lucide-react';
import { SaveButton } from './SaveButton.jsx';

const RATIO_OPTIONS = [
  { value: '4/3',  label: '4 : 3   (høyt)' },
  { value: '3/2',  label: '3 : 2' },
  { value: '16/9', label: '16 : 9  (standard)' },
  { value: '21/9', label: '21 : 9  (kinoformat)' }
];

/**
 * Innstillinger for hovedbildene på framsiden:
 * - max-høyde i piksler (slider)
 * - aspect ratio (radio-knapper)
 *
 * Endringer lagres umiddelbart til localStorage og reflekteres på framsiden
 * neste gang du går dit. Bildene har 'object-cover' så bildet alltid fyller
 * rammen — endringer i ratio kan kroppe litt av bildet, akkurat som dagens
 * adferd.
 */
export function FrontImageConfig({ imageConfig }) {
  const { config, set, reset, defaults } = imageConfig;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="panel-title">Hovedbildene på framsiden</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute hover:text-nx-cyan flex items-center gap-1"
            title={`Tilbakestill til standard (${defaults.aspectRatio} · ${defaults.maxHeight}px)`}
          >
            <RotateCcw size={11} /> Standard
          </button>
          <SaveButton sync={imageConfig.sync} />
        </div>
      </div>

      {/* Aspect ratio */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute mb-1.5">Bilde-format</p>
        <div className="flex flex-wrap gap-1.5">
          {RATIO_OPTIONS.map(opt => {
            const active = config.aspectRatio === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ aspectRatio: opt.value })}
                aria-pressed={active}
                className={[
                  'px-2.5 py-1 rounded-md text-xs font-mono transition-colors border',
                  active
                    ? 'bg-nx-cyan/15 text-nx-cyan border-nx-cyan/45 shadow-glow-soft'
                    : 'border-nx-line/60 text-nx-mute hover:text-nx-text hover:bg-nx-panel/60'
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Max høyde */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute">Maks høyde</p>
          <span className="text-xs font-mono text-nx-cyan tabular-nums">{config.maxHeight} px</span>
        </div>
        <input
          type="range"
          min={140}
          max={520}
          step={10}
          value={config.maxHeight}
          onChange={(e) => set({ maxHeight: Number(e.target.value) })}
          className="w-full accent-nx-cyan"
          aria-label="Maks høyde i piksler"
        />
        <div className="flex justify-between text-[10px] text-nx-mute font-mono mt-1">
          <span>140</span>
          <span>520</span>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-nx-mute leading-relaxed">
        Endringer lagres automatisk og vises på Oversikt og Sikkerhet-sidene neste gang du går dit.
      </p>
    </div>
  );
}
