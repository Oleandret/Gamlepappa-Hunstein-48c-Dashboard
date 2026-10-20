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
          {/* skjermflaten vender inn i rommet (mot nord) */}
          <mesh position={[(x0 + x1) / 2, (item.y0 + item.y1) / 2, Math.min(z0, z1) - 0.002]} rotation={[0, Math.PI, 0]} raycast={() => null}>
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
    default:
      return null;
  }
}

/** Maling og tapet på innsiden av veggene. */
function WallFinish({ wall, bounds, height, clip }) {
  const [bx0, bz0, bx1, bz1] = bounds;
  const map = wall.finish === 'forest' ? forestTexture() : null;
  const color = wall.finish === 'forest' ? '#ffffff' : COLORS.green;
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
export function RoomFurnishings({ floorId, baseY, clipY = null }) {
  const clip = useMemo(
    () => (clipY == null ? null : [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)]),
    [clipY]
  );
  return (
    <group position={[0, baseY + FLOOR_TOP, 0]}>
      {Object.entries(ROOM_FURNISHINGS).filter(([, f]) => f.floorId === floorId).map(([roomId, f]) => (
        <group key={roomId}>
          {f.walls.flatMap((w, i) => wallSegments(w, f.doors).map(([from, to], j) => (
            <WallFinish key={`${i}-${j}`} wall={{ ...w, from, to }} bounds={f.bounds} height={2.26} clip={clip} />
          )))}
          {f.items.map((it, i) => <Item key={i} item={it} clip={clip} />)}
        </group>
      ))}
    </group>
  );
}
