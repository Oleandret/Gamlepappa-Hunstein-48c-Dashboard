import { useMemo } from 'react';
import * as THREE from 'three';
import { ROOM_FURNISHINGS, STRUCTURE, FLOOR_TOP, wallSegments } from '../../lib/house3dFurniture.js';
import { editFor, movedBox } from '../../lib/house3dEdits.js';

/**
 * Tegner faktisk møblering (fra bilder) for rom i ROOM_FURNISHINGS.
 * Gulvstående møbler og veggflater kuttes i samme dukkehus-snitt som
 * BIM-veggene; ting som henger på veggen (TV, bilde, høyttalere) vises hele.
 */

const COLORS = {
  green: '#7d9670',
  forestSky: '#cfe3b4',
  white: '#f2f0ea',
  linen: '#e6dfd2',
  bedBase: '#d8d0c2',
  wood: '#4a3426',
  black: '#141414',
  screen: '#1b2a4a',
  chair: '#b3ab9e',
  chairShell: '#d6cfc3',
  chairDark: '#5e5951'
};

let _forest = null;
/** Enkel prosedyre-tekstur som ligner skogtapetet (bøkeskog i grønt lys). */
function forestTexture() {
  if (_forest) return _forest;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#d9ebc0'); sky.addColorStop(0.55, '#8fb65f'); sky.addColorStop(0.8, '#6a7f3a'); sky.addColorStop(1, '#5a4a2a');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 140; i++) {           // løvverk
    g.fillStyle = `rgba(${60 + rnd() * 60},${120 + rnd() * 70},${30 + rnd() * 40},${0.25 + rnd() * 0.3})`;
    g.beginPath(); g.arc(rnd() * 512, rnd() * 150, 8 + rnd() * 26, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i++) {            // stammer
    const x = rnd() * 512, w = 3 + rnd() * 11, top = rnd() * 40;
    g.fillStyle = `rgba(${55 + rnd() * 30},${45 + rnd() * 20},${30 + rnd() * 15},0.9)`;
    g.fillRect(x, top, w, 220 - top);
  }
  _forest = new THREE.CanvasTexture(c);
  _forest.colorSpace = THREE.SRGBColorSpace;
  return _forest;
}

let _stone = null;
/** Natursteinsforblending i grått (bassengrommet). */
function stoneTexture() {
  if (_stone) return _stone;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3d4044'; g.fillRect(0, 0, 512, 256);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < 256; y += 16) {
    for (let x = -rnd() * 60; x < 512; ) {
      const w = 30 + rnd() * 70, v = 95 + rnd() * 70;
      g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
      g.fillRect(x + 1.5, y + 1.5, w - 3, 13);
      x += w;
    }
  }
  _stone = new THREE.CanvasTexture(c);
  _stone.colorSpace = THREE.SRGBColorSpace;
  _stone.wrapS = _stone.wrapT = THREE.RepeatWrapping;
  return _stone;
}

let _slats = null;
/** Spilevegg: lyse eikespiler på svart filt. */
function slatTexture() {
  if (_slats) return _slats;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#151515'; g.fillRect(0, 0, 256, 16);
  g.fillStyle = '#c9a77c';
  for (let x = 0; x < 256; x += 32) g.fillRect(x + 4, 0, 14, 16);
  _slats = new THREE.CanvasTexture(c);
  _slats.colorSpace = THREE.SRGBColorSpace;
  _slats.wrapS = _slats.wrapT = THREE.RepeatWrapping;
  return _slats;
}

/** Ensfargede veggflater (malt / flislagt). */
const FINISH_COLORS = { green: COLORS.green, plywood: '#c99a62', grey: '#8e9398', beige: '#d9ccb8', white: '#eeece7' };

function Box({ x0, z0, x1, z1, y0 = 0, y1, color, clip, roughness = 0.85, metalness = 0, map, emissive, emissiveIntensity, tilt = 0, opacity = 1 }) {
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} rotation={[tilt, 0, 0]} castShadow receiveShadow raycast={() => null}>
      <boxGeometry args={[Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)]} />
      <meshStandardMaterial
        color={color} roughness={roughness} metalness={metalness} map={map || null}
        emissive={emissive || '#000000'} emissiveIntensity={emissiveIntensity || 0}
        transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1}
        clippingPlanes={clip} clipShadows
      />
    </mesh>
  );
}

function Item({ item, clip }) {
  const [x0, z0, x1, z1] = item.at;
  const b = { x0, z0, x1, z1 };
  // TV-ene vises hele, også litt over dukkehus-snittet; bilde og høyttalere
  // høyt på veggen kuttes som veggen (ellers svever de midt i rommet)
  const wallClip = item.type === 'tv' ? null : clip;
  switch (item.type) {
    case 'rug':
      return <Box {...b} y0={0.005} y1={0.02} color={item.color} clip={clip} roughness={1} />;
    case 'bed':
      return (
        <group>
          <Box {...b} y0={0} y1={0.32} color={COLORS.bedBase} clip={clip} />
          <Box {...b} y0={0.32} y1={0.55} color={COLORS.white} clip={clip} />
          {/* puter og dyne */}
          <Box x0={x0 + 0.1} x1={(x0 + x1) / 2 - 0.05} z0={z0 + 0.05} z1={z0 + 0.6} y0={0.55} y1={0.7} color={COLORS.white} clip={clip} />
          <Box x0={(x0 + x1) / 2 + 0.05} x1={x1 - 0.1} z0={z0 + 0.05} z1={z0 + 0.6} y0={0.55} y1={0.7} color={COLORS.white} clip={clip} />
          <Box x0={x0 + 0.15} x1={x1 - 0.1} z0={z0 + 0.75} z1={z1 - 0.2} y0={0.55} y1={0.66} color={COLORS.linen} clip={clip} />
        </group>
      );
    case 'bench':
      return (
        <group>
          <Box {...b} y0={0.12} y1={0.45} color={COLORS.linen} clip={clip} />
          {[[x0 + 0.05, z0 + 0.05], [x1 - 0.09, z0 + 0.05], [x0 + 0.05, z1 - 0.09], [x1 - 0.09, z1 - 0.09]].map(([lx, lz], i) => (
            <Box key={i} x0={lx} x1={lx + 0.04} z0={lz} z1={lz + 0.04} y0={0} y1={0.12} color="#c9a46e" clip={clip} />
          ))}
        </group>
      );
    case 'nightstand':
      return <Box {...b} y0={0} y1={0.6} color={COLORS.white} clip={clip} />;
    case 'smartDisplay':
      return <Box {...b} y0={item.y0} y1={item.y0 + 0.16} color={COLORS.screen} emissive="#4aa3ff" emissiveIntensity={0.6} clip={clip} />;
    case 'crib': {
      const slats = [];
      for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 5) slats.push(x);
      return (
        <group>
          <Box {...b} y0={0.3} y1={0.42} color={COLORS.white} clip={clip} />
          <Box x0={x0} x1={x1} z0={z0} z1={z0 + 0.04} y0={0.3} y1={0.9} color={COLORS.white} clip={clip} />
          <Box x0={x0} x1={x1} z0={z1 - 0.04} z1={z1} y0={0.3} y1={0.9} color={COLORS.white} clip={clip} />
          <Box x0={x1 - 0.04} x1={x1} z0={z0} z1={z1} y0={0.3} y1={0.9} color={COLORS.white} clip={clip} />
          {[[x0, z0], [x1 - 0.04, z0], [x0, z1 - 0.04], [x1 - 0.04, z1 - 0.04]].map(([lx, lz], i) => (
            <Box key={i} x0={lx} x1={lx + 0.04} z0={lz} z1={lz + 0.04} y0={0} y1={0.3} color={COLORS.white} clip={clip} />
          ))}
        </group>
      );
    }
    case 'massageChair': {
      // Liggende massasjestol i champagne/grå: rygg mot nord, fotdel mot sør (mot TV-en)
      const cx0 = x0 + 0.08, cx1 = x1 - 0.08, len = z1 - z0;
      const S = { clip, roughness: 0.35, metalness: 0.15 };
      return (
        <group>
          <Box x0={cx0 + 0.1} x1={cx1 - 0.1} z0={z0 + 0.35} z1={z1 - 0.2} y0={0} y1={0.1} color={COLORS.chairDark} {...S} />
          {/* sete og ben-/fotdel */}
          <Box x0={cx0} x1={cx1} z0={z0 + 0.5} z1={z0 + len * 0.62} y0={0.1} y1={0.5} color={COLORS.chair} {...S} />
          <Box x0={cx0 + 0.06} x1={cx1 - 0.06} z0={z0 + len * 0.6} z1={z1} y0={0.1} y1={0.38} color={COLORS.chair} {...S} tilt={0.18} />
          {/* tilbakelent rygg med hette */}
          <Box x0={cx0} x1={cx1} z0={z0} z1={z0 + 0.55} y0={0.35} y1={1.2} color={COLORS.chairShell} {...S} tilt={-0.35} />
          <Box x0={cx0 + 0.08} x1={cx1 - 0.08} z0={z0 + 0.12} z1={z0 + 0.5} y0={0.45} y1={1.05} color={COLORS.chairDark} {...S} tilt={-0.35} />
          {/* armlener (skall) */}
          <Box x0={x0} x1={x0 + 0.12} z0={z0 + 0.4} z1={z0 + len * 0.62} y0={0.25} y1={0.72} color={COLORS.chairShell} {...S} />
          <Box x0={x1 - 0.12} x1={x1} z0={z0 + 0.4} z1={z0 + len * 0.62} y0={0.25} y1={0.72} color={COLORS.chairShell} {...S} />
          {/* liten skjerm på arm */}
          <Box x0={x1 - 0.1} x1={x1 - 0.02} z0={z0 + len * 0.55} z1={z0 + len * 0.62} y0={0.72} y1={0.95} color={COLORS.black} {...S} />
        </group>
      );
    }
    case 'sideboard':
      return (
        <group>
          <Box {...b} y0={0.12} y1={0.58} color={COLORS.wood} clip={clip} roughness={0.6} />
          <Box x0={x0 + 0.05} x1={x0 + 0.09} z0={z0 + 0.05} z1={z0 + 0.09} y0={0} y1={0.12} color={COLORS.black} clip={clip} />
          <Box x0={x1 - 0.09} x1={x1 - 0.05} z0={z0 + 0.05} z1={z0 + 0.09} y0={0} y1={0.12} color={COLORS.black} clip={clip} />
        </group>
      );
    case 'tv':
      return (
        <group>
          <Box {...b} y0={item.y0} y1={item.y1} color={COLORS.black} clip={wallClip} roughness={0.3} />
          {/* skjermflaten vender inn i rommet: mot nord (standard), sør, øst eller vest (screenTo) */}
          <mesh
            position={{
              n: [(x0 + x1) / 2, (item.y0 + item.y1) / 2, z0 - 0.002],
              s: [(x0 + x1) / 2, (item.y0 + item.y1) / 2, z1 + 0.002],
              e: [x1 + 0.002, (item.y0 + item.y1) / 2, (z0 + z1) / 2],
              w: [x0 - 0.002, (item.y0 + item.y1) / 2, (z0 + z1) / 2]
            }[item.screenTo || 'n']}
            rotation={[0, { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[item.screenTo || 'n'], 0]}
            raycast={() => null}
          >
            <planeGeometry args={[(item.screenTo === 'e' || item.screenTo === 'w' ? z1 - z0 : x1 - x0) - 0.04, Math.abs(item.y1 - item.y0) - 0.04]} />
            <meshStandardMaterial color={COLORS.screen} emissive="#3b6cff" emissiveIntensity={0.35} roughness={0.2} clippingPlanes={wallClip} />
          </mesh>
          {item.stand && <Box x0={(x0 + x1) / 2 - 0.03} x1={(x0 + x1) / 2 + 0.03} z0={z0} z1={z1} y0={0.58} y1={item.y0} color={COLORS.black} clip={wallClip} />}
        </group>
      );
    case 'picture':
      return (
        <group>
          <Box {...b} y0={item.y0} y1={item.y1} color="#efe7da" clip={clip} />
          <mesh position={[(x0 + x1) / 2, (item.y0 + item.y1) / 2, Math.min(z0, z1) - 0.002]} rotation={[0, Math.PI, 0]} raycast={() => null}>
            <planeGeometry args={[Math.abs(x1 - x0) - 0.06, Math.abs(item.y1 - item.y0) - 0.06]} />
            <meshStandardMaterial color="#9b8a76" roughness={0.9} clippingPlanes={clip} />
          </mesh>
        </group>
      );
    case 'speaker':
      return <Box {...b} y0={item.y0} y1={item.y1} color={COLORS.black} clip={clip} roughness={0.5} />;
    case 'box':
      return <Box {...b} y0={item.y0 ?? 0} y1={item.y1} color={item.color} clip={item.wall ? clip : clip} roughness={item.roughness ?? 0.85} metalness={item.metalness ?? 0} />;
    case 'sofa': case 'armchair': {
      // Sete, rygg på `back`-siden og armlener på endene
      const c = item.color, h = item.type === 'armchair' ? 0.85 : 0.82, t = 0.22;
      const back = { n: { z1: z0 + t }, s: { z0: z1 - t }, e: { x0: x1 - t }, w: { x1: x0 + t } }[item.back || 's'];
      const alongX = item.back === 'n' || item.back === 's' || !item.back;
      return (
        <group>
          <Box {...b} y0={0} y1={0.44} color={c} clip={clip} />
          <Box {...b} {...back} y0={0.44} y1={h} color={c} clip={clip} />
          {alongX
            ? [[x0, x0 + 0.18], [x1 - 0.18, x1]].map(([a, d], i) => <Box key={i} x0={a} x1={d} z0={z0} z1={z1} y0={0.44} y1={0.62} color={c} clip={clip} />)
            : [[z0, z0 + 0.18], [z1 - 0.18, z1]].map(([a, d], i) => <Box key={i} x0={x0} x1={x1} z0={a} z1={d} y0={0.44} y1={0.62} color={c} clip={clip} />)}
        </group>
      );
    }
    case 'table': {
      const top = item.y1 ?? 0.75, legs = item.legs || COLORS.black;
      return (
        <group>
          <Box {...b} y0={top - 0.04} y1={top} color={item.color} clip={clip} roughness={item.glass ? 0.05 : 0.6} metalness={item.glass ? 0.2 : 0} />
          {[[x0 + 0.05, z0 + 0.05], [x1 - 0.09, z0 + 0.05], [x0 + 0.05, z1 - 0.09], [x1 - 0.09, z1 - 0.09]].map(([lx, lz], i) => (
            <Box key={i} x0={lx} x1={lx + 0.04} z0={lz} z1={lz + 0.04} y0={0} y1={top - 0.04} color={legs} clip={clip} metalness={0.4} />
          ))}
        </group>
      );
    }
    case 'chair': {
      const c = item.color, t = 0.06;
      const back = { n: { z1: z0 + t }, s: { z0: z1 - t }, e: { x0: x1 - t }, w: { x1: x0 + t } }[item.back || 'n'];
      return (
        <group>
          <Box {...b} y0={0.42} y1={0.48} color={c} clip={clip} />
          <Box {...b} {...back} y0={0.48} y1={0.88} color={c} clip={clip} />
          {[[x0 + 0.04, z0 + 0.04], [x1 - 0.07, z0 + 0.04], [x0 + 0.04, z1 - 0.07], [x1 - 0.07, z1 - 0.07]].map(([lx, lz], i) => (
            <Box key={i} x0={lx} x1={lx + 0.03} z0={lz} z1={lz + 0.03} y0={0} y1={0.42} color={COLORS.black} clip={clip} />
          ))}
        </group>
      );
    }
    case 'stool':
      return (
        <group>
          <Box {...b} y0={0.7} y1={0.76} color="#f2f2f0" clip={clip} />
          <Box x0={(x0 + x1) / 2 - 0.025} x1={(x0 + x1) / 2 + 0.025} z0={(z0 + z1) / 2 - 0.025} z1={(z0 + z1) / 2 + 0.025} y0={0} y1={0.7} color="#c0c0c0" clip={clip} metalness={0.6} />
        </group>
      );
    case 'glassCabinet':
      return (
        <group>
          <Box {...b} y0={0} y1={1.9} color="#a7c3cc" clip={clip} roughness={0.05} metalness={0.2} />
          <Box x0={x0} x1={x1} z0={z0} z1={z0 + 0.03} y0={0} y1={1.9} color={COLORS.black} clip={clip} />
        </group>
      );
    case 'car': {
      // Enkel SUV-form langs x: karosseri, kupé med mørke ruter, fire hjul.
      // Model X er høyere og lengre enn Model Y (fotavtrykket gis av `at`).
      const len = x1 - x0, c = item.color, isX = item.model !== 'Y';
      const top = isX ? 1.68 : 1.6, belt = isX ? 0.98 : 0.92;
      const S = { clip, roughness: 0.3, metalness: 0.55 };
      const wheels = [[x0 + len * 0.15, z0], [x1 - len * 0.17 - 0.72, z0], [x0 + len * 0.15, z1 - 0.25], [x1 - len * 0.17 - 0.72, z1 - 0.25]];
      return (
        <group>
          <Box x0={x0} x1={x1} z0={z0 + 0.05} z1={z1 - 0.05} y0={0.28} y1={belt} color={c} {...S} />
          <Box x0={x0 + len * 0.2} x1={x1 - len * (isX ? 0.16 : 0.2)} z0={z0 + 0.15} z1={z1 - 0.15} y0={belt} y1={top - 0.04} color="#1d2228" {...S} />
          <Box x0={x0 + len * 0.24} x1={x1 - len * (isX ? 0.2 : 0.26)} z0={z0 + 0.18} z1={z1 - 0.18} y0={top - 0.04} y1={top} color={c} {...S} />
          {wheels.map(([wx, wz], i) => (
            <Box key={i} x0={wx} x1={wx + 0.72} z0={wz} z1={wz + 0.25} y0={0} y1={0.72} color="#111111" clip={clip} roughness={0.9} />
          ))}
        </group>
      );
    }
    case 'moped':
      return (
        <group>
          <Box x0={x0 + 0.1} x1={x1 - 0.1} z0={z0 + 0.15} z1={z1 - 0.15} y0={0.25} y1={0.75} color="#1c1c1c" clip={clip} />
          <Box x0={x0 + 0.5} x1={x1 - 0.2} z0={z0 + 0.12} z1={z1 - 0.12} y0={0.75} y1={0.85} color="#e8e2d6" clip={clip} />
          <Box x0={x1 - 0.18} x1={x1 - 0.12} z0={z0} z1={z1} y0={0.3} y1={1.15} color="#d4a017" clip={clip} metalness={0.6} />
          {[x0, x1 - 0.5].map((wx, i) => <Box key={i} x0={wx} x1={wx + 0.5} z0={z0 + 0.2} z1={z1 - 0.2} y0={0} y1={0.5} color="#111111" clip={clip} />)}
        </group>
      );
    case 'slats': {
      // Spiler fordelt langs x (standard) eller langs z (`along: 'z'`)
      const alongZ = item.along === 'z', len = alongZ ? z1 - z0 : x1 - x0;
      const n = Math.max(3, Math.round(len / 0.09)), w = len / n;
      return (
        <group>
          {Array.from({ length: n }).map((_, i) => (alongZ
            ? <Box key={i} x0={x0} x1={x1} z0={z0 + i * w} z1={z0 + i * w + w * 0.55} y0={0} y1={item.y1} color={item.color} clip={clip} />
            : <Box key={i} x0={x0 + i * w} x1={x0 + i * w + w * 0.55} z0={z0} z1={z1} y0={0} y1={item.y1} color={item.color} clip={clip} />
          ))}
        </group>
      );
    }
    case 'stairs': {
      // Hvite trinnblokker med eiketrinn, ett opptrinn høyere for hvert trinn.
      // `solid`: trappa er lukket helt ned til gulvet.
      const r = item.rise / (item.steps.length + 1);
      return (
        <group>
          {item.steps.map(([sx0, sz0, sx1, sz1], i) => (
            <group key={i}>
              <Box x0={sx0} x1={sx1} z0={sz0} z1={sz1} y0={item.solid ? 0 : i * r} y1={(i + 1) * r - 0.04} color="#efeeea" clip={clip} />
              <Box x0={sx0} x1={sx1} z0={sz0} z1={sz1} y0={(i + 1) * r - 0.04} y1={(i + 1) * r} color="#c9a77c" clip={clip} roughness={0.6} />
            </group>
          ))}
        </group>
      );
    }
    case 'vanity':
      return (
        <group>
          <Box {...b} y0={0.12} y1={0.82} color={item.color} clip={clip} />
          <Box x0={x0 - 0.02} x1={x1 + 0.02} z0={z0} z1={z1 + 0.03} y0={0.82} y1={0.88} color="#f6f6f4" clip={clip} roughness={0.2} />
        </group>
      );
    case 'shower':
      return (
        <group>
          <Box {...b} y0={0} y1={0.03} color="#b8ab98" clip={clip} />
          <Box x0={x0} x1={x1} z0={z1 - 0.02} z1={z1} y0={0} y1={2.0} color="#d6eef5" clip={clip} roughness={0.05} />
          <Box x0={x1 - 0.02} x1={x1} z0={z0} z1={z1} y0={0} y1={2.0} color="#d6eef5" clip={clip} roughness={0.05} />
        </group>
      );
    case 'washer':
      return (
        <group>
          <Box {...b} y0={0} y1={0.85} color="#f4f4f4" clip={clip} roughness={0.4} />
          <mesh
            position={item.face === 'w' ? [x0 - 0.003, 0.48, (z0 + z1) / 2] : [(x0 + x1) / 2, 0.48, z1 + 0.003]}
            rotation={[0, item.face === 'w' ? -Math.PI / 2 : 0, 0]}
            raycast={() => null}
          >
            <circleGeometry args={[Math.min(x1 - x0, 0.6) * 0.32, 24]} />
            <meshStandardMaterial color="#2b3440" roughness={0.2} clippingPlanes={clip} />
          </mesh>
        </group>
      );
    case 'wardrobe':
      return (
        <group>
          <Box {...b} y0={0} y1={2.2} color="#e3d2b8" clip={clip} />
          <Box x0={x0 + 0.05} x1={x1 - 0.05} z0={z0 + 0.05} z1={z1 - 0.05} y0={0.9} y1={1.7} color="#8d8478" clip={clip} />
        </group>
      );
    case 'lounger': {
      // Ryggen i `head`-enden (n = nord, standard). Øst/vest/sør tegnes som en
      // nord-orientert solseng rundt midtpunktet og dreies.
      const head = item.head || 'n';
      if (head !== 'n') {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const across = head === 's' ? x1 - x0 : z1 - z0, along = head === 's' ? z1 - z0 : x1 - x0;
        const rot = { e: -Math.PI / 2, w: Math.PI / 2, s: Math.PI }[head];
        return (
          <group position={[cx, 0, cz]} rotation={[0, rot, 0]}>
            <Item item={{ type: 'lounger', at: [-across / 2, -along / 2, across / 2, along / 2] }} clip={clip} />
          </group>
        );
      }
      return (
        <group>
          <Box {...b} y0={0.2} y1={0.32} color="#9c7650" clip={clip} />
          <Box x0={x0 + 0.04} x1={x1 - 0.04} z0={z0 + 0.5} z1={z1 - 0.04} y0={0.32} y1={0.4} color="#ece7dc" clip={clip} />
          <Box x0={x0 + 0.04} x1={x1 - 0.04} z0={z0} z1={z0 + 0.55} y0={0.32} y1={0.75} color="#ece7dc" clip={clip} tilt={-0.6} />
          {[[x0, z0 + 0.1], [x1 - 0.05, z0 + 0.1], [x0, z1 - 0.15], [x1 - 0.05, z1 - 0.15]].map(([lx, lz], i) => (
            <Box key={i} x0={lx} x1={lx + 0.05} z0={lz} z1={lz + 0.05} y0={0} y1={0.2} color="#9c7650" clip={clip} />
          ))}
        </group>
      );
    }
    case 'outdoorKitchen':
      // Benk av betongblokk med trepaneler og granittplate
      return (
        <group>
          <Box {...b} y0={0} y1={0.9} color="#7a6450" clip={clip} />
          <Box x0={x0 - 0.03} x1={x1 + 0.03} z0={z0 - 0.03} z1={z1 + 0.03} y0={0.9} y1={0.96} color="#a3a6a8" clip={clip} roughness={0.35} />
          {Array.from({ length: Math.max(2, Math.round((z1 - z0) / 0.7)) + 1 }).map((_, i, arr) => {
            const z = z0 + (z1 - z0) * i / (arr.length - 1);
            return <Box key={i} x0={x0 - 0.01} x1={x1 + 0.01} z0={Math.min(z, z1 - 0.18)} z1={Math.min(z + 0.18, z1)} y0={0} y1={0.9} color="#a9a8a2" clip={clip} />;
          })}
        </group>
      );
    case 'pergola': {
      // Stolper, bjelker i mørkt tre og tak av herdet glass
      const h = item.y1 ?? 2.55, n = Math.max(3, Math.round((x1 - x0) / 0.8));
      return (
        <group>
          {[[x0, z1 - 0.12], [x1 - 0.12, z1 - 0.12], [x0, z0], [x1 - 0.12, z0]].map(([px, pz], i) => (
            <Box key={i} x0={px} x1={px + 0.12} z0={pz} z1={pz + 0.12} y0={0} y1={h} color="#3b3029" clip={clip} />
          ))}
          {Array.from({ length: n + 1 }).map((_, i) => {
            const x = x0 + (x1 - x0 - 0.07) * i / n;
            return <Box key={`b${i}`} x0={x} x1={x + 0.07} z0={z0} z1={z1} y0={h - 0.2} y1={h} color="#3b3029" clip={clip} />;
          })}
          <mesh position={[(x0 + x1) / 2, h + 0.01, (z0 + z1) / 2]} raycast={() => null}>
            <boxGeometry args={[x1 - x0, 0.02, z1 - z0]} />
            <meshStandardMaterial color="#9fd8ff" transparent opacity={0.3} roughness={0.05} depthWrite={false} clippingPlanes={clip} />
          </mesh>
        </group>
      );
    }
    case 'pool':
      // Vannflaten i bassenget, opplyst nedenfra, med lys flis i kanten
      return (
        <group>
          <Box x0={x0 - 0.12} x1={x1 + 0.12} z0={z0 - 0.12} z1={z1 + 0.12} y0={0} y1={0.012} color="#e9e6df" clip={clip} roughness={0.4} />
          <Box {...b} y0={0.012} y1={0.03} color="#2fc4e4" clip={clip} roughness={0.05} metalness={0.1} emissive="#0e9fd0" emissiveIntensity={0.55} />
        </group>
      );
    case 'plant':
      return (
        <group>
          <Box x0={x0 + 0.06} x1={x1 - 0.06} z0={z0 + 0.06} z1={z1 - 0.06} y0={0} y1={0.35} color="#e8e6e1" clip={clip} roughness={0.5} />
          <mesh position={[(x0 + x1) / 2, (item.y1 ?? 1.2) * 0.7, (z0 + z1) / 2]} castShadow raycast={() => null}>
            <sphereGeometry args={[Math.max(x1 - x0, z1 - z0) * 0.62, 10, 8]} />
            <meshStandardMaterial color="#3f7a3a" roughness={0.9} clippingPlanes={clip} />
          </mesh>
        </group>
      );
    case 'beanbag':
      return (
        <mesh position={[(x0 + x1) / 2, 0.26, (z0 + z1) / 2]} scale={[(x1 - x0) / 2, 0.3, (z1 - z0) / 2]} castShadow receiveShadow raycast={() => null}>
          <sphereGeometry args={[1, 18, 12]} />
          <meshStandardMaterial color={item.color} roughness={0.95} clippingPlanes={clip} />
        </mesh>
      );
    case 'sunbed': {
      // Solarium (Global 5300): benk med rør og lokk med oransje lys
      const along = (z1 - z0) >= (x1 - x0);
      const half = along ? { x0: x1 - (x1 - x0) * 0.35 } : { z0: z1 - (z1 - z0) * 0.35 };
      return (
        <group>
          <Box {...b} y0={0} y1={0.55} color="#f1f1ef" clip={clip} roughness={0.4} />
          <Box x0={x0 + 0.06} x1={x1 - 0.06} z0={z0 + 0.06} z1={z1 - 0.06} y0={0.55} y1={0.58} color="#ffb35c" clip={clip} emissive="#ff8a1e" emissiveIntensity={0.8} />
          <Box {...b} {...half} y0={0.95} y1={1.45} color="#e4e4e2" clip={clip} roughness={0.4} />
        </group>
      );
    }
    case 'treadmill': {
      // Tredemølle (Titan) med konsoll i enden mot `front`
      const f = item.front || 's';
      const post = { s: { z0: z1 - 0.12 }, n: { z1: z0 + 0.12 }, e: { x0: x1 - 0.12 }, w: { x1: x0 + 0.12 } }[f];
      return (
        <group>
          <Box {...b} y0={0} y1={0.22} color="#1c1c1c" clip={clip} />
          <Box {...b} {...post} y0={0.22} y1={1.25} color="#2a2a2a" clip={clip} />
          <Box {...b} {...post} y0={1.2} y1={1.35} color="#3a3a3a" clip={clip} />
        </group>
      );
    }
    case 'foldingChair':
      return (
        <group>
          <Box {...b} y0={0.25} y1={0.3} color={item.color} clip={clip} tilt={0.25} />
          <Box x0={x0} x1={x1} z0={z0} z1={z0 + 0.06} y0={0.3} y1={0.75} color={item.color} clip={clip} tilt={-0.35} />
        </group>
      );
    default:
      return null;
  }
}

/** Maling og tapet på innsiden av veggene. */
function WallFinish({ wall, bounds, height, clip }) {
  const [bx0, bz0, bx1, bz1] = bounds;
  const len = wall.to - wall.from, mid = (wall.from + wall.to) / 2, inset = 0.012;
  const textured = { forest: forestTexture, stone: stoneTexture, slats: slatTexture }[wall.finish];
  const map = useMemo(() => {
    if (!textured) return null;
    const t = textured();
    if (wall.finish === 'forest') return t;
    // Gjentatt mønster i fast målestokk, uavhengig av veggens lengde
    const m = t.clone();
    m.repeat.set(len / (wall.finish === 'stone' ? 2.4 : 0.8), wall.finish === 'stone' ? height / 1.2 : 1);
    m.needsUpdate = true;
    return m;
  }, [textured, wall.finish, len, height]);
  const color = textured ? '#ffffff' : FINISH_COLORS[wall.finish] ?? COLORS.green;
  const place = {
    north: { pos: [mid, height / 2, bz0 + inset], rot: 0 },
    south: { pos: [mid, height / 2, bz1 - inset], rot: Math.PI },
    west: { pos: [bx0 + inset, height / 2, mid], rot: Math.PI / 2 },
    east: { pos: [bx1 - inset, height / 2, mid], rot: -Math.PI / 2 }
  }[wall.side];
  return (
    <mesh position={place.pos} rotation={[0, place.rot, 0]} receiveShadow raycast={() => null}>
      <planeGeometry args={[len, height]} />
      <meshStandardMaterial color={color} map={map} roughness={0.95} clippingPlanes={clip} />
    </mesh>
  );
}

/**
 * @param {string}   floorId  etasjen som tegnes
 * @param {number}   baseY    gulvhøyde i scenen (inkl. spredning av etasjer)
 * @param {number|null} clipY snitthøyde i scenen (interiør), eller null
 */
/**
 * Inventar flyttet/snudd/fjernet i 3D-visningen (house3dEdits) tegnes der det er
 * flyttet til; `selectedKey` får en ramme rundt seg.
 */
function EditedItem({ item, edit, clip }) {
  if (!edit.dx && !edit.dz && !edit.rot) return <Item item={item} clip={clip} />;
  const [x0, z0, x1, z1] = item.at;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return (
    <group position={[cx + edit.dx, 0, cz + edit.dz]} rotation={[0, -edit.rot, 0]}>
      <group position={[-cx, 0, -cz]}><Item item={item} clip={clip} /></group>
    </group>
  );
}

function SelectionFrame({ at, height }) {
  const [x0, z0, x1, z1] = at;
  return (
    <mesh position={[(x0 + x1) / 2, height / 2, (z0 + z1) / 2]} raycast={() => null}>
      <boxGeometry args={[x1 - x0 + 0.06, height + 0.06, z1 - z0 + 0.06]} />
      <meshBasicMaterial color="#22e6ff" wireframe transparent opacity={0.9} depthTest={false} />
    </mesh>
  );
}

export function RoomFurnishings({ floorId, baseX = 0, baseY, baseZ = 0, clipY = null, edits = {}, selectedKey = null }) {
  const clip = useMemo(
    () => (clipY == null ? null : [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)]),
    [clipY]
  );
  return (
    <group position={[baseX, baseY + FLOOR_TOP, baseZ]}>
      {(STRUCTURE[floorId] || []).map((p, i) => {
        const [x0, z0, x1, z1] = p.at;
        return p.glass
          ? <Box key={`s${i}`} x0={x0} x1={x1} z0={z0} z1={z1} y0={p.y0} y1={p.y1} color={p.color || '#cfe9f2'} clip={clip} roughness={0.05} metalness={0.2} opacity={p.opacity ?? 0.22} />
          : <Box key={`s${i}`} x0={x0} x1={x1} z0={z0} z1={z1} y0={p.y0} y1={p.y1} color={p.color} clip={clip} />;
      })}
      {Object.entries(ROOM_FURNISHINGS).filter(([, f]) => f.floorId === floorId).map(([roomId, f]) => (
        <group key={roomId}>
          {(f.walls || []).flatMap((w, i) => wallSegments(w, f.doors).map(([from, to], j) => (
            <WallFinish key={`${i}-${j}`} wall={{ ...w, from, to }} bounds={f.bounds} height={2.26} clip={clip} />
          )))}
          {f.items.map((it, i) => {
            const key = `furniture:${roomId}:items:${i}`;
            const e = editFor(edits, key);
            if (e.removed) return null;
            return (
              <group key={i}>
                <EditedItem item={it} edit={e} clip={clip} />
                {selectedKey === key && <SelectionFrame at={movedBox(it.at, e)} height={Math.min(2.3, it.y1 ?? 1.0)} />}
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}
