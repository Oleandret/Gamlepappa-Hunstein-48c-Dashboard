import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { X, Wifi, WifiOff } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { ALL_ROOMS } from '../../lib/house3dModel.js';
import { NET_CATEGORIES, NET_CATEGORY, NET_SORTS, roomIdForName, sortNetDevices, groupKey } from '../../lib/networkDevices3d.js';
import { usePageVisibility } from '../../lib/usePageVisibility.js';

/**
 * Nettverkslaget i 3D-huset: enhetene fra hjemmenett-monitoren (MCP) som
 * små diamanter i rommet de står på i portalen, farget etter type.
 */

const REASON = {
  'not-configured': 'Hjemmenett-MCP er ikke satt opp på serveren (HJEMMENETT_MCP_URL / HJEMMENETT_MCP_TOKEN).',
  'demo-isolation': 'Demo-modus: ekte nettverksdata vises ikke.',
  unavailable: 'Fikk ikke kontakt med hjemmenett-monitoren akkurat nå.'
};

/** Henter enhetslisten hvert 30. sekund mens laget er på og fanen er synlig. */
export function useNetworkDevices(enabled) {
  const visible = usePageVisibility();
  const [state, setState] = useState({ loading: false, connected: false, reason: null, devices: [], fetchedAt: null });
  useEffect(() => {
    if (!enabled || !visible) return;
    const ctrl = new AbortController();
    let timer;
    const load = async () => {
      setState(s => ({ ...s, loading: true }));
      try {
        const r = await apiFetch('/api/network/devices', { signal: ctrl.signal });
        if (!r.ok) throw new Error();
        const d = await r.json();
        setState({ loading: false, connected: d.connected, reason: d.reason || null, fetchedAt: d.fetchedAt || null,
          devices: (d.devices || []).map(x => ({ ...x, roomId: roomIdForName(x.room) })) });
      } catch (e) {
        if (e.name !== 'AbortError') setState(s => ({ ...s, loading: false, connected: false, reason: 'unavailable' }));
      }
      if (!ctrl.signal.aborted) timer = setTimeout(load, 30_000);
    };
    load();
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [enabled, visible]);
  return state;
}

export function NetworkMarker3D({ placed, baseY, selected, showLabel, onSelect }) {
  const d = placed.device;
  const ref = useRef();
  const [hover, setHover] = useState(false);
  const color = useMemo(() => new THREE.Color(NET_CATEGORY[d.category]?.color || '#7c8aa8'), [d.category]);
  const y = baseY + placed.height;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * (d.online ? 0.9 : 0.2);
    ref.current.scale.setScalar(selected ? 1.6 : hover ? 1.3 : 1);
  });
  return (
    <group>
      <mesh
        ref={ref}
        position={[placed.x, y, placed.z]}
        onClick={(e) => { e.stopPropagation(); onSelect(d.id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={d.online ? 1.4 : 0.15} transparent opacity={d.online ? 1 : 0.45} />
      </mesh>
      {(selected || hover || showLabel) && (
        <Html position={[placed.x, y + 0.25, placed.z]} center distanceFactor={16} zIndexRange={[16, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded border bg-nx-bg/85 px-1.5 py-0.5 font-mono text-[10px] leading-none backdrop-blur-sm"
            style={{ borderColor: `${NET_CATEGORY[d.category]?.color}99`, color: NET_CATEGORY[d.category]?.color }}>
            <span className="text-nx-text">{d.name}</span>
            {(selected || hover) && d.dataLabel && <span className="ml-1">{d.dataLabel}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

export function NetworkPanel({ net, filtered, categories, onToggleCategory, onAllCategories, sort, onSort, onlineOnly, onOnlineOnly,
  roomFilter, onClearRoom, selectedId, onSelect, showLabels, onShowLabels }) {
  const counts = useMemo(() => {
    const c = {};
    for (const d of net.devices) if (!onlineOnly || d.online) c[d.category] = (c[d.category] || 0) + 1;
    return c;
  }, [net.devices, onlineOnly]);
  const sorted = useMemo(() => sortNetDevices(filtered, sort), [filtered, sort]);
  const selected = net.devices.find(d => d.id === selectedId);
  const placed = filtered.filter(d => d.roomId).length;
  const allOn = categories.size === NET_CATEGORIES.length;

  let lastGroup;
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="panel-title">Nettverk · hjemmenett-monitor</p>
          <h3 className="mt-1 text-lg font-semibold">
            {net.connected ? `${filtered.length} enheter` : 'Ikke tilkoblet'}
          </h3>
          <p className="font-mono text-[10px] text-nx-mute">
            {net.connected
              ? `${net.devices.filter(d => d.online).length} av ${net.devices.length} på nett · ${placed} plassert i modellen`
              : (net.loading ? 'Henter …' : REASON[net.reason] || REASON.unavailable)}
          </p>
        </div>
        {net.connected ? <Wifi size={16} className="text-nx-cyan" aria-hidden="true" /> : <WifiOff size={16} className="text-nx-mute" aria-hidden="true" />}
      </div>

      {selected && (
        <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: `${NET_CATEGORY[selected.category].color}66` }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{selected.name}</p>
            <button onClick={() => onSelect(null)} aria-label="Lukk" className="text-nx-mute hover:text-nx-cyan"><X size={14} /></button>
          </div>
          <dl className="grid gap-x-3 gap-y-0.5 font-mono text-[10px]" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <dt className="text-nx-mute">Type</dt><dd style={{ color: NET_CATEGORY[selected.category].color }}>{NET_CATEGORY[selected.category].label}</dd>
            <dt className="text-nx-mute">Status</dt><dd className={selected.online ? 'text-nx-green' : 'text-nx-mute'}>{selected.status || (selected.online ? 'på nett' : 'av nett')}</dd>
            <dt className="text-nx-mute">Rom</dt><dd>{selected.room || '—'}{selected.room && !selected.roomId && <span className="text-nx-amber"> (finnes ikke i modellen)</span>}</dd>
            <dt className="text-nx-mute">Eier</dt><dd>{selected.owner || '—'}</dd>
            <dt className="text-nx-mute">IP</dt><dd>{selected.ip || '—'}</dd>
            <dt className="text-nx-mute">MAC</dt><dd>{selected.id}</dd>
            <dt className="text-nx-mute">Data 24 t</dt><dd>{selected.dataLabel || '—'}</dd>
          </dl>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-mute">Vis</p>
          <button onClick={onAllCategories} className="font-mono text-[10px] text-nx-mute hover:text-nx-cyan">{allOn ? 'Ingen' : 'Alle'}</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {NET_CATEGORIES.map(c => {
            const on = categories.has(c.id);
            return (
              <button key={c.id} onClick={() => onToggleCategory(c.id)} aria-pressed={on}
                className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                style={on ? { borderColor: `${c.color}99`, color: c.color, background: `${c.color}1a` } : { borderColor: '#2a3a55', color: '#7c8aa8' }}>
                <span className="h-1.5 w-1.5 rotate-45" style={{ background: on ? c.color : '#3a4a65' }} />
                {c.label} <span className="opacity-70">{counts[c.id] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 font-mono text-[10px] text-nx-mute">
          Sorter
          <select value={sort} onChange={e => onSort(e.target.value)} className="rounded border border-nx-line/60 bg-nx-bg px-1 py-0.5 text-nx-text">
            {NET_SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 font-mono text-[10px] text-nx-mute cursor-pointer">
          <input type="checkbox" checked={onlineOnly} onChange={e => onOnlineOnly(e.target.checked)} className="accent-nx-cyan" /> Bare på nett
        </label>
        <label className="flex items-center gap-1 font-mono text-[10px] text-nx-mute cursor-pointer">
          <input type="checkbox" checked={showLabels} onChange={e => onShowLabels(e.target.checked)} className="accent-nx-cyan" /> Navn i modellen
        </label>
      </div>

      {roomFilter && (
        <button onClick={onClearRoom} className="inline-flex items-center gap-1 rounded border border-nx-cyan/50 bg-nx-cyan/10 px-1.5 py-0.5 font-mono text-[10px] text-nx-cyan">
          Rom: {ALL_ROOMS.find(r => r.id === roomFilter)?.name} <X size={10} />
        </button>
      )}

      <ul className="divide-y divide-nx-line/40 rounded-lg border border-nx-line/60 bg-nx-panel/40">
        {sorted.map(d => {
          const g = groupKey(d, sort);
          const header = g !== null && g !== lastGroup;
          lastGroup = g;
          return (
            <li key={d.id}>
              {header && <p className="bg-nx-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-nx-cyan">{g}</p>}
              <button onClick={() => onSelect(d.id)}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-nx-cyan/5 ${selectedId === d.id ? 'bg-nx-cyan/10' : ''}`}>
                <span className="h-2 w-2 shrink-0 rotate-45" style={{ background: NET_CATEGORY[d.category].color, opacity: d.online ? 1 : 0.35 }} />
                <span className={`flex-1 truncate ${d.online ? '' : 'text-nx-mute'}`}>{d.name}</span>
                {sort !== 'owner' && d.owner && <span className="truncate max-w-[70px] font-mono text-[10px] text-nx-mute">{d.owner}</span>}
                <span className="w-14 text-right font-mono text-[10px] text-nx-mute">{d.dataLabel || ''}</span>
              </button>
            </li>
          );
        })}
        {net.connected && sorted.length === 0 && <li className="px-2.5 py-2 text-[11px] text-nx-mute">Ingen enheter passer filteret.</li>}
      </ul>
      <p className="text-[10px] text-nx-mute leading-relaxed">
        Rommet er det enheten står på i hjemmenett-portalen. Enheter uten rom, eller med et rom modellen ikke har, vises bare i listen.
        «På nett» betyr sett på hjemmenettet siste 15 minutter.
      </p>
    </div>
  );
}
