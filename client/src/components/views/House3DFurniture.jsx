import { useMemo } from 'react';
import * as THREE from 'three';
import { ROOM_FURNISHINGS, FLOOR_TOP, wallSegments } from '../../lib/house3dFurniture.js';

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

function Box({ x0, z0, x1, z1, y0 = 0, y1, color, clip, roughness = 0.85, metalness = 0, map, emissive, emissiveIntensity, tilt = 0 }) {
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} rotation={[tilt, 0, 0]} castShadow receiveShadow raycast={() => null}>
      <boxGeometry args={[Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)]} />
      <meshStandardMaterial
        color={color} roughness={roughness} metalness={metalness} map={map || null}
        emissive={emissive || '#000000'} emissiveIntensity={emissiveIntensity || 0}
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
          {/* skjermflaten vender inn i rommet (mot nord, eller mot sør med screenTo: 's') */}
          <mesh
            position={[(x0 + x1) / 2, (item.y0 + item.y1) / 2, item.screenTo === 's' ? Math.max(z0, z1) + 0.002 : Math.min(z0, z1) - 0.002]}
            rotation={[0, item.screenTo === 's' ? 0 : Math.PI, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[Math.abs(x1 - x0) - 0.04, Math.abs(item.y1 - item.y0) - 0.04]} />
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
      const n = Math.max(3, Math.round((x1 - x0) / 0.09)), w = (x1 - x0) / n;
      return (
        <group>
          {Array.from({ length: n }).map((_, i) => (
            <Box key={i} x0={x0 + i * w} x1={x0 + i * w + w * 0.55} z0={z0} z1={z1} y0={0} y1={item.y1} color={item.color} clip={clip} />
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
    case 'lounger':
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
  const map = wall.finish === 'forest' ? forestTexture() : null;
  const color = wall.finish === 'forest' ? '#ffffff' : wall.finish === 'plywood' ? '#c99a62' : COLORS.green;
  const len = wall.to - wall.from, mid = (wall.from + wall.to) / 2, inset = 0.012;
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
export function RoomFurnishings({ floorId, baseX = 0, baseY, baseZ = 0, clipY = null }) {
  const clip = useMemo(
    () => (clipY == null ? null : [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)]),
    [clipY]
  );
  return (
    <group position={[baseX, baseY + FLOOR_TOP, baseZ]}>
      {Object.entries(ROOM_FURNISHINGS).filter(([, f]) => f.floorId === floorId).map(([roomId, f]) => (
        <group key={roomId}>
          {(f.walls || []).flatMap((w, i) => wallSegments(w, f.doors).map(([from, to], j) => (
            <WallFinish key={`${i}-${j}`} wall={{ ...w, from, to }} bounds={f.bounds} height={2.26} clip={clip} />
          )))}
          {f.items.map((it, i) => <Item key={i} item={it} clip={clip} />)}
        </group>
      ))}
    </group>
  );
}
