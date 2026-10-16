import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { capValue, hasCap } from '../../lib/deviceUtils.js';

/**
 * Visualisering av enheter i 3D-hus:
 *  - Enheter står i realistisk monteringshøyde etter type (tak, vegg, gulv, dør).
 *  - Lys lyser opp rommet med faktisk dimmenivå (punktlys + lysvolum i rommet).
 *  - Hver enhet viser verdien sin: %, °C, W, åpen/lukket, låst/ulåst, bevegelse.
 *  - Dører og garasjeport åpnes i modellen når sensoren melder åpen.
 */

const AMBER = new THREE.Color('#ffb84a');
const WARM = new THREE.Color('#ffcf8a');

export function isLightDevice(d) { return d?.class === 'light' || hasCap(d, 'dim'); }

function lightLevel(d) {
  if (!hasCap(d, 'onoff') && !hasCap(d, 'dim')) return 0;
  if (hasCap(d, 'onoff') && !capValue(d, 'onoff')) return 0;
  const dim = capValue(d, 'dim');
  return Number.isFinite(dim) ? Math.max(0.04, dim) : 1;
}

/** Monteringshøyde over gulv (m) etter enhetstype. */
export function mountHeight(d, ceiling) {
  const ceil = ceiling - 0.08;
  if (hasCap(d, 'alarm_smoke') || hasCap(d, 'alarm_co') || isLightDevice(d)) return ceil;
  if (hasCap(d, 'alarm_motion')) return Math.min(2.3, ceil);
  if (d.class === 'camera') return Math.min(2.4, ceil);
  if (hasCap(d, 'alarm_contact') || hasCap(d, 'garagedoor_closed')) return 2.0;
  if (hasCap(d, 'alarm_water')) return 0.05;
  if (hasCap(d, 'target_temperature')) return 1.2;
  if (hasCap(d, 'measure_temperature') || hasCap(d, 'measure_humidity')) return 1.5;
  if (hasCap(d, 'locked')) return 1.05;
  if (d.class === 'socket') return 0.35;
  if (d.class === 'speaker') return 2.0;
  if (d.class === 'tv') return 1.1;
  return 1.2;
}

const TEMP_STOPS = [[14, '#3b6cff'], [18, '#22e6ff'], [21, '#3ddc84'], [24, '#ffb84a'], [27, '#ff5c7a']].map(([t, c]) => [t, new THREE.Color(c)]);
export function tempColor3(t) {
  if (!Number.isFinite(t)) return new THREE.Color('#7c8aa8');
  if (t <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1].clone();
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i];
    const [t0, c0] = TEMP_STOPS[i - 1];
    if (t <= t1) return c0.clone().lerp(c1, (t - t0) / (t1 - t0));
  }
  return TEMP_STOPS[TEMP_STOPS.length - 1][1].clone();
}

/** Kort tekst + farge for det enheten «står på». */
export function deviceReadout(d, doorOpen) {
  if (doorOpen === true) return { text: 'Åpen', color: '#ffb84a', tone: 'alert' };
  if (doorOpen === false) return { text: 'Lukket', color: '#3ddc84', tone: 'ok' };
  if (capValue(d, 'alarm_motion') === true) return { text: 'Bevegelse', color: '#ff5c7a', tone: 'alert' };
  if (capValue(d, 'alarm_smoke') === true) return { text: 'RØYK', color: '#ff5c7a', tone: 'alert' };
  if (capValue(d, 'alarm_water') === true) return { text: 'VANN', color: '#ff5c7a', tone: 'alert' };
  if (hasCap(d, 'locked')) return capValue(d, 'locked') ? { text: 'Låst', color: '#3ddc84' } : { text: 'Ulåst', color: '#ffb84a', tone: 'alert' };
  if (hasCap(d, 'alarm_contact')) return capValue(d, 'alarm_contact') ? { text: 'Åpen', color: '#ffb84a', tone: 'alert' } : { text: 'Lukket', color: '#3ddc84' };
  if (isLightDevice(d)) {
    const l = lightLevel(d);
    return l > 0 ? { text: hasCap(d, 'dim') ? `${Math.round(l * 100)}%` : 'På', color: '#ffb84a', level: l } : { text: 'Av', color: '#7c8aa8', level: 0 };
  }
  const target = capValue(d, 'target_temperature');
  const temp = capValue(d, 'measure_temperature');
  if (Number.isFinite(target)) {
    const t = Number.isFinite(temp) ? `${temp.toFixed(1)}° → ${target.toFixed(1)}°` : `→ ${target.toFixed(1)}°`;
    return { text: t, color: `#${tempColor3(Number.isFinite(temp) ? temp : target).getHexString()}`, temp: Number.isFinite(temp) ? temp : target };
  }
  if (Number.isFinite(temp)) {
    const hum = capValue(d, 'measure_humidity');
    return { text: `${temp.toFixed(1)}°${Number.isFinite(hum) ? ` · ${Math.round(hum)}%` : ''}`, color: `#${tempColor3(temp).getHexString()}`, temp };
  }
  const power = capValue(d, 'measure_power');
  if (hasCap(d, 'onoff')) {
    const on = !!capValue(d, 'onoff');
    const w = Number.isFinite(power) && on ? ` · ${Math.round(power)} W` : '';
    return { text: (on ? 'På' : 'Av') + w, color: on ? '#3ddc84' : '#7c8aa8', power: on && Number.isFinite(power) ? power : 0 };
  }
  if (Number.isFinite(power)) return { text: `${Math.round(power)} W`, color: '#7d5cff', power };
  return { text: d.class || '', color: '#7d5cff' };
}

// ─── Enhetsmarkør ───────────────────────────────────────────────────────

export function DeviceMarker3D({ marker, baseY, ceiling, selected, onSelect, doorOpen, showValue }) {
  const d = marker.device;
  const h = mountHeight(d, ceiling);
  const read = deviceReadout(d, doorOpen);
  const ref = useRef();
  const haloRef = useRef();
  const color = useMemo(() => new THREE.Color(read.color), [read.color]);
  const alert = read.tone === 'alert';
  const level = read.level ?? 0;
  const powerScale = read.power ? Math.min(1, Math.log10(1 + read.power) / 3) : 0;
  const isTemp = Number.isFinite(read.temp);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      const pulse = alert ? 1 + 0.3 * Math.sin(t * 6) : 1;
      ref.current.scale.setScalar((selected ? 1.5 : 1) * pulse);
    }
    if (haloRef.current) {
      const s = isTemp ? 1 + 0.08 * Math.sin(t * 1.5)
        : read.power ? 1 + powerScale * 0.4 * (0.5 + 0.5 * Math.sin(t * (2 + powerScale * 6)))
        : 1;
      haloRef.current.scale.setScalar(s);
    }
  });

  const y = baseY + h;
  const haloSize = level > 0 ? 0.25 + level * 0.45 : isTemp ? 0.32 : read.power ? 0.18 + powerScale * 0.5 : alert ? 0.4 : 0;

  return (
    <group>
      <mesh position={[marker.x, baseY + 0.12 + (h - 0.12) / 2, marker.z]} raycast={() => null}>
        <cylinderGeometry args={[0.01, 0.01, Math.max(0.05, h - 0.12), 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <mesh
        ref={ref}
        position={[marker.x, y, marker.z]}
        onClick={(e) => { e.stopPropagation(); onSelect(marker); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <sphereGeometry args={[0.11, 20, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4 + (level || (alert ? 1 : 0.5)) * 1.6} />
      </mesh>
      {haloSize > 0 && (
        <mesh ref={haloRef} position={[marker.x, y, marker.z]} raycast={() => null}>
          <sphereGeometry args={[haloSize, 20, 14]} />
          <meshBasicMaterial color={color} transparent opacity={0.18 + level * 0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {(showValue || selected) && read.text && (
        <Html position={[marker.x, y + 0.32, marker.z]} center distanceFactor={16} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="whitespace-nowrap rounded border bg-nx-bg/85 px-1.5 py-0.5 font-mono text-[10px] leading-none backdrop-blur-sm"
            style={{ borderColor: `${read.color}99`, color: read.color }}
          >
            {selected && <span className="text-nx-text mr-1">{marker.label || d.name}</span>}
            {read.text}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Lys i rommet ───────────────────────────────────────────────────────

/**
 * Ett punktlys per lyskilde i taket, med styrke etter dimmenivå, pluss et
 * svakt lysvolum som fyller rommet. Lyskilder uten pin plasseres i rommets
 * sentrum. Begrenset antall punktlys for ytelse.
 */
export function RoomLighting({ lights, maxLights = 24 }) {
  const list = lights.filter(l => l.level > 0).sort((a, b) => b.level - a.level).slice(0, maxLights);
  return (
    <group>
      {list.map((l) => (
        <group key={l.key} position={[l.x, l.y, l.z]}>
          <pointLight color={WARM} intensity={0.8 + l.level * 7} distance={2.5 + l.level * 5} decay={1.6} />
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.08 + l.level * 0.08, 12, 10]} />
            <meshBasicMaterial color={AMBER} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Lysvolum som fyller rommet med styrke etter snitt-dimmenivå. */
export function RoomLightVolume({ poly, height, level }) {
  const geom = useMemo(() => {
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [poly, height]);
  if (!(level > 0)) return null;
  return (
    <mesh geometry={geom} position={[0, 0.13, 0]} raycast={() => null}>
      <meshBasicMaterial color={AMBER} transparent opacity={0.04 + level * 0.16} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Dører ──────────────────────────────────────────────────────────────

/**
 * Animerer dørblad/port som BimGroup har lagt i hengsel-pivoter
 * (registry: Map doorId → [{pivot, meta, mats, v}]).
 */
export function DoorAnimator({ registry, openState }) {
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3.5);
    for (const [id, entries] of registry.current) {
      const target = openState[id] === true ? 1 : 0;
      for (const e of entries) {
        if (Math.abs(target - e.v) < 0.001 && e.applied) continue;
        e.v += (target - e.v) * k;
        const { meta, pivot } = e;
        if (meta.kind === 'swing') pivot.rotation.y = meta.yaw + meta.openRot * e.v;
        else if (meta.kind === 'slide') pivot.scale.x = 1 - (1 - (meta.openScale ?? 0.5)) * e.v;
        else if (meta.kind === 'garage') pivot.rotation.x = meta.openTilt * e.v;
        for (const m of e.mats) {
          if (!m.emissive) continue;
          m.emissive.copy(AMBER);
          m.emissiveIntensity = 0.55 * e.v;
        }
        e.applied = true;
      }
    }
  });
  return null;
}
