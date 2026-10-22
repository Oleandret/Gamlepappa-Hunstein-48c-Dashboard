import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MessageSquarePlus, X, Trash2, Check, ExternalLink, MapPin, Link2, Move, RotateCw, RotateCcw, Undo2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, EyeOff, Eye } from 'lucide-react';
import { editKey, editFor, canRotate } from '../../lib/house3dEdits.js';
import { isDoorSensor } from '../../lib/house3dDoors.js';

/**
 * Pek i 3D-modellen: trykk på noe, velg hva det gjelder, og enten
 *  - skriv et endringsønske (lagres på serveren; når eieren ber Claude om «ny
 *    modell», gjøres endringene i koden, se docs/ENDRINGSONSKER.md), eller
 *  - koble en Homey-enhet hit (dørsensor → døra, andre enheter → pin på stedet).
 */

const STATUS = {
  ny: { label: 'Ny', cls: 'text-nx-cyan border-nx-cyan/50' },
  'pågår': { label: 'Pågår', cls: 'text-nx-amber border-nx-amber/50' },
  gjort: { label: 'Gjort', cls: 'text-nx-green border-nx-green/50' },
  avvist: { label: 'Avvist', cls: 'text-nx-mute border-nx-line' }
};

export function ChangePanel({ pick, changes, onClear, onShow, floorLabel, devices, onLinkDevice, linkedTo, choice = 0, onChoice, modelEdits }) {
  const setChoice = onChoice;
  const [text, setText] = useState('');
  const [action, setAction] = useState('change');
  const candidates = pick?.candidates || [];
  const open = changes.items.filter(i => i.status === 'ny' || i.status === 'pågår');
  const closed = changes.items.filter(i => i.status === 'gjort' || i.status === 'avvist');

  async function submit(e) {
    e.preventDefault();
    const target = candidates[choice];
    if (!target) return;
    const saved = await changes.add(target, text);
    if (saved) { setText(''); onClear(); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="panel-title">Endringsønsker</p>
          <h3 className="mt-1 text-lg font-semibold flex items-center gap-2"><MessageSquarePlus size={18} className="text-nx-cyan" aria-hidden="true" />Ønsk en endring</h3>
          <p className="text-xs text-nx-mute mt-1">Trykk på det som er feil eller skal endres i modellen. Ønskene samles her, og når du ber Claude om «ny modell», blir de gjort.</p>
        </div>
      </div>

      {!pick && <p className="rounded-lg border border-dashed border-nx-cyan/40 p-3 text-xs text-nx-cyan">Trykk på en vegg, et møbel, en lampe eller et gulv i modellen.</p>}

      {pick && (
        <form onSubmit={submit} className="rounded-lg border border-nx-cyan/40 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-cyan">Hva gjelder det? · {floorLabel(pick.floorId)}</p>
            <button type="button" onClick={onClear} aria-label="Avbryt" className="text-nx-mute hover:text-nx-cyan"><X size={14} /></button>
          </div>
          <div className="space-y-1" role="radiogroup" aria-label="Element">
            {candidates.map((c, i) => (
              <label key={`${c.kind}-${c.elementId || c.globalId || i}`} className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer ${choice === i ? 'bg-nx-cyan/10 text-nx-text' : 'text-nx-mute hover:text-nx-text'}`}>
                <input type="radio" name="change-target" checked={choice === i} onChange={() => setChoice(i)} className="mt-0.5" />
                <span className="min-w-0 break-words">{c.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Hva vil du gjøre?">
            {[['change', 'Ønsk', MessageSquarePlus], ['move', 'Flytt/fjern', Move], ['device', 'Koble enhet', Link2]].map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setAction(id)} aria-pressed={action === id}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${action === id ? 'border-nx-cyan/60 bg-nx-cyan/15 text-nx-cyan' : 'border-nx-line/60 text-nx-mute hover:text-nx-text'}`}>
                <Icon size={11} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          {action === 'change' ? (
            <>
              <label className="block">
                <span className="sr-only">Hva skal endres?</span>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1000} required
                  placeholder="F.eks. Sofaen er grå, ikke beige · Her er det en dør til · Spoten sitter 50 cm lenger mot vinduet"
                  className="w-full rounded-lg border border-nx-line/70 bg-nx-panel/60 px-2.5 py-2 text-sm placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60" />
              </label>
              <button type="submit" disabled={changes.busy || text.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-md bg-nx-cyan/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-nx-cyan disabled:opacity-40">
                <MessageSquarePlus size={12} aria-hidden="true" />Legg til ønske
              </button>
            </>
          ) : action === 'move' ? (
            <MoveControls target={candidates[choice]} modelEdits={modelEdits} />
          ) : (
            <DeviceLinker target={candidates[choice]} devices={devices} linkedTo={linkedTo} onLink={(devId) => onLinkDevice(candidates[choice], devId)} />
          )}
        </form>
      )}

      {changes.error && <p role="alert" className="text-xs text-nx-amber">{changes.error}</p>}

      <ChangeList title={`Åpne ønsker · ${open.length}`} items={open} changes={changes} onShow={onShow} empty="Ingen åpne ønsker." />
      {modelEdits && <EditList modelEdits={modelEdits} />}
      {closed.length > 0 && <ChangeList title={`Ferdige · ${closed.length}`} items={closed.slice(0, 20)} changes={changes} onShow={onShow} />}
    </div>
  );
}

/**
 * Velg en Homey-enhet å koble til det valgte elementet. For en dør vises
 * dørsensorene først; ellers sorteres enhetene i samme rom først.
 */
function DeviceLinker({ target, devices, linkedTo, onLink }) {
  const [q, setQ] = useState('');
  const [devId, setDevId] = useState('');
  const [done, setDone] = useState('');
  useEffect(() => { setDevId(''); setDone(''); }, [target]);
  const isDoor = target?.kind === 'door';
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return Object.values(devices || {})
      .filter(d => d?.id && (!isDoor || isDoorSensor(d)))
      .filter(d => words.every(w => `${d.name} ${d.zoneName || ''}`.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
      .slice(0, 80);
  }, [devices, q, isDoor]);
  const current = target ? linkedTo(target) : null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-nx-mute">
        {isDoor ? 'Velg dørsensoren for denne døra. Døra åpnes i modellen når sensoren melder åpen.' : 'Enheten festes som pin akkurat der du trykket, også på 2D-plantegningen.'}
        {current && <span className="block mt-0.5 text-nx-cyan">Koblet nå: {current}</span>}
      </p>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={isDoor ? 'Søk dørsensor …' : 'Søk enhet …'}
        className="w-full rounded-lg border border-nx-line/70 bg-nx-panel/60 px-2.5 py-1.5 text-sm placeholder:text-nx-mute focus:outline-none focus:border-nx-cyan/60" />
      <select size={6} value={devId} onChange={e => setDevId(e.target.value)} aria-label="Enhet"
        className="w-full rounded-lg border border-nx-line/70 bg-nx-panel/60 px-1 py-1 text-sm focus:outline-none focus:border-nx-cyan/60">
        {list.map(d => <option key={d.id} value={d.id}>{d.name}{d.zoneName ? ` · ${d.zoneName}` : ''}</option>)}
      </select>
      {!list.length && <p className="text-[11px] text-nx-amber">{isDoor ? 'Fant ingen dørsensorer.' : 'Fant ingen enheter.'}</p>}
      <button type="button" disabled={!devId} onClick={() => { onLink(devId); setDone(devices?.[devId]?.name || 'Enheten'); }}
        className="inline-flex items-center gap-1.5 rounded-md bg-nx-cyan/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-nx-cyan disabled:opacity-40">
        <Link2 size={12} aria-hidden="true" />{isDoor ? 'Koble til døra' : 'Fest enheten her'}
      </button>
      {done && <p role="status" className="text-[11px] text-nx-green">{done} er koblet. Lagres automatisk.</p>}
    </div>
  );
}

const STEPS = [0.05, 0.1, 0.5];
const fmt = v => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} cm`;

/**
 * Flytt valgt inventar, lyspunkt eller BIM-element med piltaster (øst/vest/nord/sør),
 * snu inventar, eller fjern det. Lagres på serveren med en gang.
 */
function MoveControls({ target, modelEdits }) {
  const [step, setStep] = useState(0.1);
  const key = editKey(target);
  if (!key) return <p className="text-[11px] text-nx-mute">Velg et møbel, et lyspunkt eller et BIM-element i listen over for å flytte eller fjerne det. Rom og punkter kan ikke flyttes; skriv heller et ønske.</p>;
  const e = editFor(modelEdits.edits, key);
  const door = target.kind === 'door';
  const move = (dx, dz) => modelEdits.update(key, { dx, dz, label: target.label });
  const btn = 'inline-flex items-center justify-center rounded-md border border-nx-line/60 p-1.5 text-nx-mute hover:text-nx-cyan hover:border-nx-cyan/50 disabled:opacity-40';
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-nx-mute">
        {e.removed ? 'Fjernet fra modellen.' : (e.dx || e.dz || e.rot) ? `Flyttet ${fmt(e.dx)} øst, ${fmt(e.dz)} sør${e.rot ? `, snudd ${Math.round(e.rot * 180 / Math.PI)}°` : ''}.` : 'Står der den står i modellen.'}
        <span className="block">Endringen lagres med en gang og vises for alle.</span>
      </p>
      {!e.removed && !door && (
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Flytt">
            <span />
            <button type="button" className={btn} onClick={() => move(0, -step)} title="Nord" aria-label="Flytt mot nord"><ArrowUp size={14} /></button>
            <span />
            <button type="button" className={btn} onClick={() => move(-step, 0)} title="Vest" aria-label="Flytt mot vest"><ArrowLeft size={14} /></button>
            <span className="text-center font-mono text-[9px] text-nx-mute self-center">N↑</span>
            <button type="button" className={btn} onClick={() => move(step, 0)} title="Øst" aria-label="Flytt mot øst"><ArrowRight size={14} /></button>
            <span />
            <button type="button" className={btn} onClick={() => move(0, step)} title="Sør" aria-label="Flytt mot sør"><ArrowDown size={14} /></button>
            <span />
          </div>
          <div className="space-y-1.5">
            <div className="flex gap-1" role="group" aria-label="Steg">
              {STEPS.map(s => (
                <button key={s} type="button" onClick={() => setStep(s)} aria-pressed={step === s}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${step === s ? 'bg-nx-cyan/15 text-nx-cyan' : 'text-nx-mute hover:text-nx-text'}`}>{Math.round(s * 100)} cm</button>
              ))}
            </div>
            {canRotate(key) && (
              <div className="flex gap-1">
                <button type="button" className={btn} onClick={() => modelEdits.update(key, { rot: -Math.PI / 12, label: target.label })} title="Snu 15° mot klokka" aria-label="Snu mot klokka"><RotateCcw size={14} /></button>
                <button type="button" className={btn} onClick={() => modelEdits.update(key, { rot: Math.PI / 12, label: target.label })} title="Snu 15° med klokka" aria-label="Snu med klokka"><RotateCw size={14} /></button>
                <button type="button" className={`${btn} px-2 font-mono text-[10px]`} onClick={() => modelEdits.update(key, { rot: Math.PI / 2, label: target.label })} title="Snu 90°">90°</button>
              </div>
            )}
          </div>
        </div>
      )}
      {door && !e.removed && <p className="text-[11px] text-nx-mute">Dører kan fjernes, men ikke flyttes her. Skriv et ønske hvis døra står feil.</p>}
      <div className="flex flex-wrap gap-1.5">
        {e.removed ? (
          <button type="button" className={`${btn} gap-1 px-2 text-[11px]`} onClick={() => modelEdits.update(key, { removed: false })}><Eye size={12} />Vis igjen</button>
        ) : (
          <button type="button" className={`${btn} gap-1 px-2 text-[11px] hover:text-nx-red hover:border-nx-red/50`}
            onClick={() => { if (window.confirm(`Fjerne «${target.label}» fra modellen?`)) modelEdits.update(key, { removed: true, label: target.label }); }}>
            <EyeOff size={12} />Fjern
          </button>
        )}
        {(e.dx || e.dz || e.rot || e.removed) ? (
          <button type="button" className={`${btn} gap-1 px-2 text-[11px]`} onClick={() => modelEdits.reset(key)}><Undo2 size={12} />Tilbakestill</button>
        ) : null}
      </div>
    </div>
  );
}

/** Alt som er flyttet eller fjernet direkte i modellen, med angre per element. */
function EditList({ modelEdits }) {
  const list = Object.entries(modelEdits.edits);
  if (!list.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-mute">Flyttet/fjernet i modellen · {list.length}</p>
        <button type="button" onClick={() => { if (window.confirm('Tilbakestille alle flyttinger og fjerninger?')) modelEdits.resetAll(); }} className="font-mono text-[10px] text-nx-mute hover:text-nx-amber">Tilbakestill alle</button>
      </div>
      <ul className="mt-1 divide-y divide-nx-line/40">
        {list.map(([key, e]) => (
          <li key={key} className="py-1.5 flex gap-2 items-start text-xs">
            <span className="flex-1 min-w-0 break-words">
              {e.label || key}
              <span className="block text-[11px] text-nx-mute">{e.removed ? 'Fjernet' : `${fmt(e.dx)} øst, ${fmt(e.dz)} sør${e.rot ? `, ${Math.round(e.rot * 180 / Math.PI)}°` : ''}`}</span>
            </span>
            <button type="button" onClick={() => modelEdits.reset(key)} title="Angre" aria-label={`Angre ${e.label || key}`} className="p-1 text-nx-mute hover:text-nx-cyan"><Undo2 size={13} /></button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-nx-mute">Si «lag ny modell» til Claude for å bygge dette inn i modellen for godt.</p>
    </section>
  );
}

function ChangeList({ title, items, changes, onShow, empty }) {
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-mute">{title}</p>
      {!items.length && empty && <p className="mt-1 text-xs text-nx-mute">{empty}</p>}
      <ul className="mt-1 divide-y divide-nx-line/40">
        {items.map(i => {
          const st = STATUS[i.status] || STATUS.ny;
          return (
            <li key={i.id} className="py-2 flex gap-2 items-start">
              <button type="button" onClick={() => onShow(i)} title="Vis i modellen" className="mt-0.5 text-nx-mute hover:text-nx-cyan" aria-label="Vis i modellen"><MapPin size={14} /></button>
              <div className="flex-1 min-w-0">
                <p className="text-sm break-words">{i.text}</p>
                <p className="text-[11px] text-nx-mute mt-0.5 break-words">
                  <span className={`mr-1.5 inline-block rounded border px-1 font-mono text-[9px] uppercase ${st.cls}`}>{st.label}</span>
                  {i.target?.label}{i.target?.roomName && !i.target.label?.includes(i.target.roomName) ? ` · ${i.target.roomName}` : ''}
                </p>
                {i.note && <p className="text-[11px] text-nx-mute mt-0.5">{i.note}</p>}
                {i.pr && <a href={i.pr} target="_blank" rel="noreferrer" className="text-[11px] text-nx-cyan inline-flex items-center gap-1 mt-0.5">PR <ExternalLink size={10} /></a>}
              </div>
              {i.status === 'ny' && (
                <>
                  <button type="button" disabled={changes.busy} onClick={() => changes.setStatus(i.id, 'avvist')} title="Trekk tilbake" aria-label="Trekk tilbake" className="p-1 text-nx-mute hover:text-nx-amber disabled:opacity-40"><X size={14} /></button>
                  <button type="button" disabled={changes.busy} onClick={() => { if (window.confirm('Slette ønsket?')) changes.remove(i.id); }} title="Slett" aria-label="Slett" className="p-1 text-nx-mute hover:text-nx-red disabled:opacity-40"><Trash2 size={14} /></button>
                </>
              )}
              {i.status === 'gjort' && <Check size={14} className="mt-0.5 text-nx-green" aria-label="Gjort" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Markør der brukeren trykket, og nålehoder for åpne ønsker. */
export function ChangeMarkers3D({ pickWorld, items }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.scale.setScalar(1 + 0.25 * Math.sin(clock.elapsedTime * 5)); });
  return (
    <group>
      {pickWorld && (
        <mesh ref={ref} position={pickWorld} raycast={() => null}>
          <sphereGeometry args={[0.14, 20, 14]} />
          <meshBasicMaterial color="#22e6ff" transparent opacity={0.85} depthTest={false} />
        </mesh>
      )}
      {items.map((it, n) => (
        <group key={it.id} position={it.world}>
          <mesh position={[0, 0.35, 0]} raycast={() => null}>
            <coneGeometry args={[0.1, 0.3, 12]} />
            <meshBasicMaterial color={it.status === 'pågår' ? '#ffb84a' : '#22e6ff'} depthTest={false} transparent opacity={0.9} />
          </mesh>
          <Html position={[0, 0.65, 0]} center distanceFactor={16} zIndexRange={[16, 0]} style={{ pointerEvents: 'none' }}>
            <div className="rounded-full border border-nx-cyan/60 bg-nx-bg/85 px-1.5 font-mono text-[10px] text-nx-cyan">{n + 1}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}
