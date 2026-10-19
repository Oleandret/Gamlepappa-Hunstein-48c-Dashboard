import { useMemo } from 'react';
import * as THREE from 'three';
import { INTERIORS } from '../../lib/house3dInteriors.js';

/**
 * Tegner interiør (vegger, gulv og møbler) for rom som er modellert fra rombilder.
 * Lokale koordinater: gruppen står på etasjens gulv; romplatene er 0,12 m tykke.
 * Alle materialer klippes i samme snitthøyde som BIM-modellen (dukkehus-snitt).
 */
const FLOOR_TOP = 0.12;
const WALL_H = 2.5;
const PAINT_INSET = 0.015;
const noRaycast = () => null;

let _forest = null, _terrazzo = null;
function forestTexture() {
  if (_forest) return _forest;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#cfe3a8'); sky.addColorStop(0.45, '#8fb35a'); sky.addColorStop(0.8, '#55692f'); sky.addColorStop(1, '#4a3b22');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${90 + rnd() * 60},${140 + rnd() * 60},${40 + rnd() * 40},0.35)`; g.beginPath(); g.arc(rnd() * 1024, rnd() * 300, 20 + rnd() * 60, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 1024, w = 6 + rnd() * 22, shade = 60 + rnd() * 50;
    g.fillStyle = `rgb(${shade + 20},${shade},${shade - 25})`; g.fillRect(x, rnd() * 80, w, 512);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w * 0.6, 0, w * 0.4, 512);
  }
  g.fillStyle = 'rgba(70,52,28,0.7)'; g.fillRect(0, 440, 1024, 72);
  _forest = new THREE.CanvasTexture(c); _forest.colorSpace = THREE.SRGBColorSpace;
  return _forest;
}
function terrazzoTexture() {
  if (_terrazzo) return _terrazzo;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, 256, 256);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) { const v = 120 + rnd() * 90; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  _terrazzo = new THREE.CanvasTexture(c); _terrazzo.wrapS = _terrazzo.wrapT = THREE.RepeatWrapping; _terrazzo.repeat.set(4, 4); _terrazzo.colorSpace = THREE.SRGBColorSpace;
  return _terrazzo;
}

function Mat({ color, planes, ...rest }) {
  return <meshStandardMaterial color={color} roughness={0.8} clippingPlanes={planes} clipShadows {...rest} />;
}
// Boks fra [x0,z0,x1,z1] og høyde y0..y1 (over ferdig gulv).
function Block({ box, y0 = 0, y1, color, planes, ...mat }) {
  const [x0, z0, x1, z1] = box;
  return (
    <mesh position={[(x0 + x1) / 2, FLOOR_TOP + (y0 + y1) / 2, (z0 + z1) / 2]} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={[Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)]} />
      <Mat color={color} planes={planes} {...mat} />
    </mesh>
  );
}

// Veggflate (eller gardin) langs en side av rommet.
function sidePanel(bounds, side, from, to, inset) {
  const [x0, z0, x1, z1] = bounds;
  if (side === 'n') return { pos: [(from + to) / 2, z0 + inset], rot: 0, len: to - from };
  if (side === 's') return { pos: [(from + to) / 2, z1 - inset], rot: Math.PI, len: to - from };
  if (side === 'e') return { pos: [x1 - inset, (from + to) / 2], rot: -Math.PI / 2, len: to - from };
  return { pos: [x0 + inset, (from + to) / 2], rot: Math.PI / 2, len: to - from };
}
function Panel({ bounds, side, from, to, inset = PAINT_INSET, y0 = 0, y1 = WALL_H, planes, children }) {
  const p = sidePanel(bounds, side, from, to, inset);
  return (
    <mesh position={[p.pos[0], FLOOR_TOP + (y0 + y1) / 2, p.pos[1]]} rotation={[0, p.rot, 0]} receiveShadow raycast={noRaycast}>
      <planeGeometry args={[Math.abs(p.len), y1 - y0]} />
      {children}
    </mesh>
  );
}

function Bed({ box, planes }) {
  const [x0, z0, x1, z1] = box;
  return <group>
    <Block box={box} y1={0.32} color="#ddd6c8" planes={planes} />
    <Block box={[x0 + 0.02, z0 + 0.02, x1 - 0.02, z1 - 0.02]} y0={0.32} y1={0.55} color="#f1f0ea" planes={planes} />
    <Block box={[x0 + 0.08, z0 + 0.08, x0 + 0.78, z0 + 0.48]} y0={0.55} y1={0.70} color="#fbfbf8" planes={planes} />
    <Block box={[x1 - 0.78, z0 + 0.08, x1 - 0.08, z0 + 0.48]} y0={0.55} y1={0.70} color="#fbfbf8" planes={planes} />
    <Block box={[x0 + 0.05, z0 + 0.55, x1 - 0.05, z1 - 0.10]} y0={0.55} y1={0.64} color="#e7dfcd" planes={planes} />
  </group>;
}
function Crib({ box, h, planes }) {
  const [x0, z0, x1, z1] = box, white = '#f4f4f1', slats = [];
  for (let z = z0 + 0.06; z < z1 - 0.04; z += 0.09) {
    slats.push(<Block key={`a${z}`} box={[x0, z, x0 + 0.03, z + 0.025]} y0={0.3} y1={h} color={white} planes={planes} />);
    slats.push(<Block key={`b${z}`} box={[x1 - 0.03, z, x1, z + 0.025]} y0={0.3} y1={h} color={white} planes={planes} />);
  }
  return <group>
    {[[x0, z0], [x1 - 0.05, z0], [x0, z1 - 0.05], [x1 - 0.05, z1 - 0.05]].map(([x, z]) => <Block key={`${x}${z}`} box={[x, z, x + 0.05, z + 0.05]} y1={h} color={white} planes={planes} />)}
    <Block box={[x0, z0, x1, z0 + 0.04]} y0={0.3} y1={h} color={white} planes={planes} />
    <Block box={[x0, z1 - 0.04, x1, z1]} y0={0.3} y1={h} color={white} planes={planes} />
    <Block box={[x0 + 0.03, z0 + 0.04, x1 - 0.03, z1 - 0.04]} y0={0.30} y1={0.40} color="#f7f2ea" planes={planes} />
    {slats}
  </group>;
}
// Massasjestol: sokkel, sete, ryggen mot nord, armlener og leggstøtte mot TV-en.
function MassageChair({ box, planes }) {
  const [x0, z0, x1, z1] = box, taupe = '#a59c8f', silver = '#c8c4bd', len = z1 - z0;
  return <group>
    <Block box={[x0 + 0.1, z0 + 0.25, x1 - 0.1, z1 - 0.35]} y1={0.18} color={silver} planes={planes} metalness={0.3} />
    <Block box={[x0 + 0.12, z0 + 0.35, x1 - 0.12, z0 + len * 0.62]} y0={0.18} y1={0.52} color={taupe} planes={planes} />
    <mesh position={[(x0 + x1) / 2, FLOOR_TOP + 0.85, z0 + 0.32]} rotation={[0.55, 0, 0]} castShadow raycast={noRaycast}>
      <boxGeometry args={[x1 - x0 - 0.16, 0.95, 0.3]} /><Mat color={taupe} planes={planes} />
    </mesh>
    <Block box={[x0, z0 + 0.35, x0 + 0.14, z0 + len * 0.62]} y0={0.18} y1={0.75} color={silver} planes={planes} metalness={0.3} />
    <Block box={[x1 - 0.14, z0 + 0.35, x1, z0 + len * 0.62]} y0={0.18} y1={0.75} color={silver} planes={planes} metalness={0.3} />
    <mesh position={[(x0 + x1) / 2, FLOOR_TOP + 0.32, z1 - 0.28]} rotation={[-0.6, 0, 0]} castShadow raycast={noRaycast}>
      <boxGeometry args={[x1 - x0 - 0.3, 0.5, 0.22]} /><Mat color={taupe} planes={planes} />
    </mesh>
  </group>;
}
function Bench({ box, h, planes }) {
  const [x0, z0, x1, z1] = box;
  return <group>
    <Block box={box} y0={0.12} y1={h} color="#d8cdbd" planes={planes} />
    {[[x0 + 0.04, z0 + 0.04], [x1 - 0.08, z0 + 0.04], [x0 + 0.04, z1 - 0.08], [x1 - 0.08, z1 - 0.08]].map(([x, z]) => <Block key={`${x}${z}`} box={[x, z, x + 0.04, z + 0.04]} y1={0.12} color="#c49a6c" planes={planes} />)}
  </group>;
}
function Sideboard({ box, h, planes }) {
  const [x0, z0, x1, z1] = box, ribs = [];
  for (let x = x0 + 0.04; x < x1 - 0.03; x += 0.05) ribs.push(<Block key={x} box={[x, z0 - 0.01, x + 0.015, z0]} y0={0.12} y1={h - 0.03} color="#2f2118" planes={planes} />);
  return <group>
    <Block box={box} y0={0.10} y1={h} color="#4a3426" planes={planes} />
    {[[x0 + 0.05, z0 + 0.05], [x1 - 0.08, z0 + 0.05], [x0 + 0.05, z1 - 0.08], [x1 - 0.08, z1 - 0.08]].map(([x, z]) => <Block key={`${x}${z}`} box={[x, z, x + 0.03, z + 0.03]} y1={0.10} color="#1c1c1c" planes={planes} />)}
    {ribs}
  </group>;
}
function Tv({ bounds, side, from, to, y0, y1, on, planes }) {
  return <group>
    <Panel bounds={bounds} side={side} from={from} to={to} inset={0.05} y0={y0} y1={y1}><Mat color="#0d0e10" planes={planes} side={THREE.DoubleSide} /></Panel>
    <Panel bounds={bounds} side={side} from={from + 0.03} to={to - 0.03} inset={0.056} y0={y0 + 0.03} y1={y1 - 0.03}>
      <Mat color={on ? '#2f63c9' : '#15171b'} emissive={on ? '#2a5cc4' : '#000000'} emissiveIntensity={on ? 0.6 : 0} roughness={0.25} planes={planes} />
    </Panel>
  </group>;
}

function Item({ item, def, planes }) {
  const { box, h } = item;
  switch (item.type) {
    case 'rug': return <Block box={box} y1={0.012} color={item.color} planes={planes} roughness={1} />;
    case 'bed': return <Bed box={box} planes={planes} />;
    case 'nightstand': return <Block box={box} y1={h} color="#efefeb" planes={planes} />;
    case 'crib': return <Crib box={box} h={h} planes={planes} />;
    case 'massageChair': return <MassageChair box={box} planes={planes} />;
    case 'bench': return <Bench box={box} h={h} planes={planes} />;
    case 'sideboard': return <Sideboard box={box} h={h} planes={planes} />;
    case 'tv': return <Tv bounds={def.bounds} {...item} planes={planes} />;
    default: return box ? <Block box={box} y1={h || 0.5} color={item.color || '#9aa3ad'} planes={planes} /> : null;
  }
}

export function RoomInterior({ roomId, clipY, overlay }) {
  const def = INTERIORS[roomId];
  const planes = useMemo(() => clipY == null ? null : [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)], [clipY]);
  if (!def) return null;
  const [x0, z0, x1, z1] = def.bounds;
  return (
    <group>
      {/* Gulvbelegg bare i standardvisningen, så temperatur-/sikkerhetsfargene på gulvet fortsatt vises */}
      {def.floor === 'terrazzo' && (overlay === 'all' || overlay === 'light') && (
        <mesh position={[(x0 + x1) / 2, FLOOR_TOP + 0.003, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={noRaycast}>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
          <meshStandardMaterial map={terrazzoTexture()} roughness={0.55} />
        </mesh>
      )}
      {Object.entries(def.walls).flatMap(([side, segs]) => segs.map((s, i) => (
        <Panel key={`${side}${i}`} bounds={def.bounds} side={side} from={s.from} to={s.to} planes={planes}>
          {s.mural === 'forest'
            ? <meshStandardMaterial map={forestTexture()} roughness={0.9} clippingPlanes={planes} clipShadows />
            : <Mat color={def.wallColor} planes={planes} roughness={0.9} />}
        </Panel>
      )))}
      {(def.blinds || []).map((b, i) => (
        <Panel key={`blind${i}`} bounds={def.bounds} side={b.side} from={b.from} to={b.to} inset={0.04} y0={0.05} y1={2.35}>
          <Mat color="#26292d" planes={planes} roughness={0.95} side={THREE.DoubleSide} />
        </Panel>
      ))}
      {def.items.map((item, i) => <Item key={i} item={item} def={def} planes={planes} />)}
    </group>
  );
}

export const hasInterior = roomId => Boolean(INTERIORS[roomId]);
