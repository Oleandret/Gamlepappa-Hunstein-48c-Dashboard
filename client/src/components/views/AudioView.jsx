import { useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Speaker, Cast } from 'lucide-react';
import { capValue, hasCap } from '../../lib/deviceUtils.js';

/**
 * Multi-room audio: groups all speakers (Sonos / Chromecast / Spotify / etc.)
 * by their sonos_group when available, then by zone.
 */
export function AudioView({ devices, zones, onSet }) {
  const speakers = useMemo(() =>
    Object.values(devices || {}).filter(d =>
      d.class === 'speaker' || d.class === 'tv' && hasCap(d, 'speaker_playing')
    ),
    [devices]
  );

  const groups = useMemo(() => groupSpeakers(speakers, zones), [speakers, zones]);
  const playing = speakers.filter(s => capValue(s, 'speaker_playing')).length;

  return (
    <div>
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="panel-title">Lyd · multi-room</h2>
          <p className="mt-1 text-xl font-semibold">
            {speakers.length} <span className="text-nx-mute text-sm font-normal">høyttalere</span>
            {playing > 0 && <span className="ml-3 text-nx-cyan text-sm">🎵 {playing} spiller nå</span>}
          </p>
        </div>
      </header>

      <div className="mt-5 space-y-5">
        {groups.map(g => (
          <GroupSection key={g.key} group={g} onSet={onSet} />
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-nx-mute">Ingen høyttalere funnet.</p>
        )}
      </div>
    </div>
  );
}

function GroupSection({ group, onSet }) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-2">
        <Cast size={13} className="text-nx-cyan" aria-hidden="true" />
        <h3 className="panel-title flex-1">{group.label}</h3>
        <span className="text-[10px] text-nx-mute font-mono">{group.speakers.length} enheter</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {group.speakers.map(s => <SpeakerCard key={s.id} speaker={s} onSet={onSet} />)}
      </div>
    </section>
  );
}

function SpeakerCard({ speaker, onSet }) {
  const playing = capValue(speaker, 'speaker_playing');
  const volume = capValue(speaker, 'volume_set');
  const muted = capValue(speaker, 'volume_mute');
  const artist = capValue(speaker, 'speaker_artist');
  const track  = capValue(speaker, 'speaker_track');
  const album  = capValue(speaker, 'speaker_album');
  const set = (cap, value) => onSet?.(speaker.id, cap, value);

  return (
    <div className={[
      'panel p-3 flex flex-col gap-2',
      playing ? 'border-nx-cyan/55' : ''
    ].join(' ')}>
      <header className="flex items-start gap-2">
        <span className={[
          'grid h-8 w-8 place-items-center rounded-lg shrink-0',
          playing ? 'bg-nx-cyan/15 text-nx-cyan shadow-glow-soft animate-pulseGlow' : 'bg-nx-panel/60 text-nx-mute'
        ].join(' ')}>
          <Speaker size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-tight truncate" title={speaker.name}>{speaker.name}</div>
          {(artist || track) && (
            <div className="text-[10px] text-nx-mute font-mono truncate" title={`${artist} — ${track}`}>
              {artist}{artist && track ? ' — ' : ''}{track}
            </div>
          )}
          {!playing && !track && (
            <div className="text-[10px] text-nx-mute font-mono">stoppet</div>
          )}
        </div>
      </header>

      <div className="flex items-center gap-1.5">
        {hasCap(speaker, 'speaker_prev') && (
          <button
            onClick={() => set('speaker_prev', true)}
            aria-label="Forrige spor"
            className="grid h-7 w-7 place-items-center rounded-md border border-nx-line/60 hover:border-nx-cyan/55 hover:text-nx-cyan transition-colors"
          ><SkipBack size={12} aria-hidden="true" /></button>
        )}
        <button
          onClick={() => set('speaker_playing', !playing)}
          aria-label={playing ? 'Pause' : 'Spill av'}
          aria-pressed={!!playing}
          className={[
            'grid h-9 w-9 place-items-center rounded-md transition-colors',
            playing
              ? 'bg-nx-cyan text-nx-bg'
              : 'border border-nx-line/60 text-nx-cyan hover:bg-nx-cyan/10'
          ].join(' ')}
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>
        {hasCap(speaker, 'speaker_next') && (
          <button
            onClick={() => set('speaker_next', true)}
            aria-label="Neste spor"
            className="grid h-7 w-7 place-items-center rounded-md border border-nx-line/60 hover:border-nx-cyan/55 hover:text-nx-cyan transition-colors"
          ><SkipForward size={12} aria-hidden="true" /></button>
        )}
        {hasCap(speaker, 'volume_mute') && (
          <button
            onClick={() => set('volume_mute', !muted)}
            aria-label={muted ? 'Slå på lyd' : 'Demp'}
            aria-pressed={!!muted}
            className={[
              'grid h-7 w-7 place-items-center rounded-md border transition-colors ml-auto',
              muted ? 'border-nx-amber/55 text-nx-amber bg-nx-amber/10' : 'border-nx-line/60 text-nx-mute hover:text-nx-text'
            ].join(' ')}
          >
            {muted ? <VolumeX size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />}
          </button>
        )}
      </div>

      {volume != null && (
        <label className="flex items-center gap-2 text-[11px]">
          <Volume2 size={11} className="text-nx-mute" aria-hidden="true" />
          <input
            type="range" min="0" max="1" step="0.01" value={Math.max(0, Math.min(1, +volume || 0))}
            onChange={e => set('volume_set', Number(e.target.value))}
            aria-label={`${speaker.name} volum`}
            className="flex-1 accent-nx-cyan"
          />
          <span className="font-mono w-9 text-right">{Math.round(volume * 100)}%</span>
        </label>
      )}
    </div>
  );
}

function groupSpeakers(speakers, zones) {
  const byKey = new Map();
  for (const s of speakers) {
    // Prefer sonos_group (real audio sync group), fall back to zone, then "Annet"
    const sonosGroup = capValue(s, 'sonos_group');
    const zoneName = zones?.[s.zone]?.name;
    const key = sonosGroup || zoneName || 'Annet';
    if (!byKey.has(key)) byKey.set(key, { key, label: key, speakers: [] });
    byKey.get(key).speakers.push(s);
  }
  return [...byKey.values()].sort((a, b) => b.speakers.length - a.speakers.length);
}
