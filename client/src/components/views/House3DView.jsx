import { Component, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Edges, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  Box, Layers, Lightbulb, Thermometer, ShieldAlert, Home as HomeIcon, Edit2,
  RotateCw, Power, ChevronRight, X, Move3d, Activity, DoorOpen, Lock, Unlock
} from 'lucide-react';
import { FLOORS, ALL_ROOMS, roomPoly, roomCenter, roomArea, planPctToWorld, BIM_MODEL_URL } from '../../lib/house3dModel.js';
import { capValue, hasCap } from '../../lib/deviceUtils.js';
import { useHouse3dRooms } from '../../lib/useHouse3dRooms.js';
import { DeviceControls } from '../FloorPlanPin.jsx';
import { canWrite } from '../../lib/deviceCommands.js';
import { DeviceCommandStatus, useDeviceCommand } from '../DeviceCommandStatus.jsx';
import { SaveButton } from '../SaveButton.jsx';
import { DeviceMarker3D, RoomLighting, RoomLightVolume, DoorAnimator, isLightDevice, deviceReadout } from './House3DDevices.jsx';
import { useDoorMeta, useHouse3dDoors, resolveDoorLinks, isDoorSensor, doorSensorOpen } from '../../lib/house3dDoors.js';

/**
 * Interaktiv 3D-modell av Hunstein 48c. Bygningskroppen er BIM-modellen
 * («som bygget», eksportert fra IFC til GLB); rommene oppå brukes til klikk,
 * overlegg og Homey-styring. Faller tilbake til de forenklede rom-volumene
 * hvis GLB-en ikke kan lastes.
 *
 *  - Eksteriør: hele huset med kledning, vindusbånd og terrasser. Rom med
 *    lys på gløder ut gjennom vinduene.
 *  - Interiør: "dukkehus"-snitt med rom, vegger og enhets-pins. Etasjene kan
 *    trekkes fra hverandre, eller vises én og én.
 *
 * Klikk et rom for å styre alle enheter i rommet (lys, varme, lås ...).
 */

const CENTER = [-3.2, 0, 1.8];

const C = {
  bg: '#05070d',
  cyan: '#22e6ff',
  amber: '#ffb84a',
  red: '#ff5c7a',
  green: '#3ddc84',
  purple: '#7d5cff',
  mute: '#7c8aa8',
  floor: '#0f1a2e',
  cladding: '#2a2d33',
  claddingDark: '#1d1f24',
  accent: '#ff7a1a',
  deck: '#5a4632'
};

const OVERLAYS = [
  { id: 'all',      label: 'Alle',        Icon: Layers },
  { id: 'light',    label: 'Lys',         Icon: Lightbulb },
  { id: 'temp',     label: 'Temperatur',  Icon: Thermometer },
  { id: 'security', label: 'Sikkerhet',   Icon: ShieldAlert }
];

// ─── Data ───────────────────────────────────────────────────────────────

function pointInPoly([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function zoneDescendants(zoneIds, zones) {
  const out = new Set(zoneIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const z of Object.values(zones || {})) {
      if (z?.parent && out.has(z.parent) && !out.has(z.id)) { out.add(z.id); grew = true; }
    }
  }
  return out;
}

function isLight(d) { return d?.class === 'light' || hasCap(d, 'dim'); }

function roomStats(devs) {
  const temps = [];
  let lights = 0, lightsOn = 0, dimSum = 0, motion = false, open = false, unlocked = false, power = 0;
  for (const d of devs) {
    const t = capValue(d, 'measure_temperature');
    if (Number.isFinite(t)) temps.push(t);
    if (isLight(d) && hasCap(d, 'onoff')) {
      lights++;
      if (capValue(d, 'onoff')) {
        lightsOn++;
        const dim = capValue(d, 'dim');
        dimSum += Number.isFinite(dim) ? Math.max(0.15, dim) : 1;
      }
    }
    if (capValue(d, 'alarm_motion') === true) motion = true;
    if (capValue(d, 'alarm_contact') === true) open = true;
    if (hasCap(d, 'locked') && capValue(d, 'locked') === false) unlocked = true;
    const p = capValue(d, 'measure_power');
    if (Number.isFinite(p)) power += p;
  }
  return {
    temp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    lights, lightsOn,
    glow: lights ? Math.min(1, dimSum / Math.max(1, lights)) : 0,
    motion, open, unlocked, power
  };
}

function useRoomData(devices, zones, roomConfig, floorPlanPins) {
  return useMemo(() => {
    const devList = Object.values(devices || {});
    const zoneList = Object.values(zones || {});

    // Pins fra 2D-plantegningene → verdensposisjon
    const markers = [];
    for (const floor of FLOORS) {
      const pins = floorPlanPins?.getPins?.(floor.planId) || [];
      for (const pin of pins) {
        const w = planPctToWorld(floor.planId, pin.x, pin.y);
        const device = devices?.[pin.deviceId];
        if (!w || !device) continue;
        const room = floor.rooms.find(r => pointInPoly(w, roomPoly(r)));
        markers.push({ id: pin.id, floorId: floor.id, x: w[0], z: w[1], device, label: pin.label, roomId: room?.id || null });
      }
    }

    const byRoom = {};
    for (const room of ALL_ROOMS) {
      const manual = roomConfig?.[room.id];
      const zoneIds = Array.isArray(manual)
        ? manual
        : zoneList.filter(z => z?.name && room.match?.test(z.name)).map(z => z.id);
      const allZones = zoneDescendants(zoneIds, zones);
      const ids = new Set();
      const devs = [];
      for (const d of devList) {
        if (d.zone && allZones.has(d.zone) && !ids.has(d.id)) { ids.add(d.id); devs.push(d); }
      }
      for (const m of markers) {
        if (m.roomId === room.id && !ids.has(m.device.id)) { ids.add(m.device.id); devs.push(m.device); }
      }
      byRoom[room.id] = { room, zoneIds, manual: Array.isArray(manual), devices: devs, stats: roomStats(devs) };
    }
    return { byRoom, markers };
  }, [devices, zones, roomConfig, floorPlanPins]);
}

// ─── Farger ─────────────────────────────────────────────────────────────

const TEMP_STOPS = [
  [14, new THREE.Color('#3b6cff')],
  [18, new THREE.Color('#22e6ff')],
  [21, new THREE.Color('#3ddc84')],
  [24, new THREE.Color('#ffb84a')],
  [27, new THREE.Color('#ff5c7a')]
];

function tempColor(t) {
  if (!Number.isFinite(t)) return new THREE.Color(C.floor);
  if (t <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1].clone();
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i];
    const [t0, c0] = TEMP_STOPS[i - 1];
    if (t <= t1) return c0.clone().lerp(c1, (t - t0) / (t1 - t0));
  }
  return TEMP_STOPS[TEMP_STOPS.length - 1][1].clone();
}

function floorColorFor(room, stats, overlay) {
  if (room.outdoor) return new THREE.Color(C.deck);
  if (overlay === 'temp') return tempColor(stats.temp);
  if (overlay === 'security') {
    if (stats.motion) return new THREE.Color(C.red);
    if (stats.open || stats.unlocked) return new THREE.Color(C.amber);
    return new THREE.Color('#123227');
  }
  if (overlay === 'light') {
    return new THREE.Color(C.floor).lerp(new THREE.Color(C.amber), stats.glow * 0.55);
  }
  if (room.kind === 'pool') return new THREE.Color('#0d5d7a');
  return new THREE.Color(C.floor).lerp(new THREE.Color(C.amber), stats.glow * 0.25);
}

function markerColor(d) {
  if (!d) return C.mute;
  if (capValue(d, 'alarm_motion') === true) return C.red;
  if (capValue(d, 'alarm_contact') === true) return C.amber;
  if (hasCap(d, 'locked')) return capValue(d, 'locked') ? C.green : C.amber;
  if (isLight(d)) return capValue(d, 'onoff') ? C.amber : C.mute;
  if (hasCap(d, 'target_temperature') || hasCap(d, 'measure_temperature')) return C.cyan;
  if (hasCap(d, 'onoff')) return capValue(d, 'onoff') ? C.green : C.mute;
  return C.purple;
}

// ─── Geometri-hjelpere ──────────────────────────────────────────────────

function useSlabGeometry(poly, depth, grow = 0) {
  return useMemo(() => {
    const pts = grow ? growPoly(poly, grow) : poly;
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [poly, depth, grow]);
}

/** Enkel utvidelse av et polygon ut fra sentroiden (godt nok for rektangler/trapeser). */
function growPoly(poly, d) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, z]) => [x + Math.sign(x - cx) * d, z + Math.sign(z - cz) * d]);
}

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,200,120,1)');
  grd.addColorStop(0.35, 'rgba(255,170,70,0.45)');
  grd.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

// ─── Rom: interiør ──────────────────────────────────────────────────────

function InteriorRoom({ data, overlay, selected, hovered, onSelect, onHover, showLabel, floorHeight }) {
  const { room, stats, devices } = data;
  const poly = roomPoly(room);
  const slab = useSlabGeometry(poly, 0.12);
  const color = useMemo(() => floorColorFor(room, stats, overlay), [room, stats, overlay]);
  const matRef = useRef();
  const [cx, cz] = roomCenter(room);
  const wallH = room.outdoor ? 1.0 : 1.15;

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const pulse = (overlay === 'security' || overlay === 'all') && stats.motion
      ? 0.35 + 0.35 * Math.sin(clock.elapsedTime * 5)
      : 0;
    matRef.current.emissiveIntensity = selected ? 0.55 : hovered ? 0.3 : pulse;
  });

  const walls = useMemo(() => poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    return { len: Math.hypot(dx, dz), mx: (p[0] + q[0]) / 2, mz: (p[1] + q[1]) / 2, rot: -Math.atan2(dz, dx) };
  }), [poly]);

  const span = useMemo(() => {
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  }, [poly]);

  const showGlow = !room.outdoor && stats.lightsOn > 0 && overlay !== 'temp' && overlay !== 'security';
  const edgeColor = selected ? C.cyan : stats.motion && overlay !== 'light' ? C.red : '#2a4a6e';

  return (
    <group>
      <mesh
        geometry={slab}
        onClick={(e) => { e.stopPropagation(); onSelect(room.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(room.id); }}
        onPointerOut={() => onHover(null)}
        receiveShadow
      >
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={selected ? C.cyan : stats.motion ? C.red : C.cyan}
          emissiveIntensity={0}
          roughness={room.kind === 'pool' ? 0.15 : 0.8}
          metalness={room.kind === 'pool' ? 0.3 : 0.05}
        />
      </mesh>

      {walls.map((w, i) => (
        <mesh key={i} position={[w.mx, 0.12 + wallH / 2, w.mz]} rotation={[0, w.rot, 0]} raycast={() => null}>
          <boxGeometry args={[w.len, wallH, room.outdoor ? 0.04 : 0.1]} />
          <meshStandardMaterial
            color={room.outdoor ? '#9fd8ff' : '#1f3352'}
            transparent
            opacity={room.outdoor ? 0.18 : 0.55}
            roughness={0.4}
          />
          <Edges color={edgeColor} threshold={15} />
        </mesh>
      ))}

      {showGlow && (
        <>
          <mesh position={[cx, 0.14, cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[span * 1.4, span * 1.4]} />
            <meshBasicMaterial
              map={glowTexture()}
              transparent
              opacity={0.35 + stats.glow * 0.65}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[cx, floorHeight - 0.2, cz]} raycast={() => null}>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshBasicMaterial color={C.amber} />
          </mesh>
          <mesh position={[cx, floorHeight - 0.2, cz]} raycast={() => null}>
            <sphereGeometry args={[0.45, 16, 12]} />
            <meshBasicMaterial color={C.amber} transparent opacity={0.12 + stats.glow * 0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </>
      )}

      {(showLabel || selected || hovered) && (
        <Html position={[cx, wallH + 0.5, cz]} center distanceFactor={15} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <RoomLabel room={room} stats={stats} deviceCount={devices.length} overlay={overlay} active={selected || hovered} />
        </Html>
      )}
    </group>
  );
}

function RoomLabel({ room, stats, deviceCount, overlay, active }) {
  return (
    <div
      className={[
        'whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[11px] leading-tight backdrop-blur-sm select-none',
        active ? 'border-nx-cyan/70 bg-nx-bg/90 text-nx-cyan shadow-glow-soft' : 'border-nx-line/70 bg-nx-bg/75 text-nx-text'
      ].join(' ')}
    >
      <div className="font-semibold tracking-wide">{room.name}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-nx-mute">
        {Number.isFinite(stats.temp) && (
          <span className={overlay === 'temp' ? 'text-nx-cyan' : ''}>{stats.temp.toFixed(1)}°</span>
        )}
        {stats.lights > 0 && (
          <span className={stats.lightsOn ? 'text-nx-amber' : ''}>💡 {stats.lightsOn}/{stats.lights}</span>
        )}
        {stats.motion && <span className="text-nx-red">● bevegelse</span>}
        {stats.open && <span className="text-nx-amber">● åpen</span>}
        {!Number.isFinite(stats.temp) && stats.lights === 0 && !stats.motion && (
          <span>{deviceCount ? `${deviceCount} enh` : `${roomArea(room).toFixed(1)} m²`}</span>
        )}
      </div>
    </div>
  );
}

// ─── Rom: eksteriør ─────────────────────────────────────────────────────

function ExteriorRoom({ data, floor, onSelect, selected, hovered, onHover }) {
  const { room, stats } = data;
  const poly = roomPoly(room);
  const totalH = floor.height + 0.3;
  const body = useSlabGeometry(poly, totalH, room.outdoor ? 0 : 0.16);
  const band = useSlabGeometry(poly, 1.25, 0.19);
  const deck = useSlabGeometry(poly, 0.15);
  const railing = useSlabGeometry(poly, 1.0, -0.02);

  const select = (e) => { e.stopPropagation(); onSelect(room.id); };
  const over = (e) => { e.stopPropagation(); onHover(room.id); };

  if (room.outdoor) {
    return (
      <group>
        <mesh geometry={deck} onClick={select} onPointerOver={over} onPointerOut={() => onHover(null)} castShadow receiveShadow>
          <meshStandardMaterial color={C.deck} roughness={0.9} emissive={C.cyan} emissiveIntensity={selected ? 0.4 : hovered ? 0.2 : 0} />
        </mesh>
        <mesh geometry={railing} position={[0, 0.15, 0]} raycast={() => null}>
          <meshStandardMaterial color="#bfe9ff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          <Edges color="#5f7d99" threshold={40} />
        </mesh>
      </group>
    );
  }

  const glass = room.kind === 'glass';
  const accent = room.id === 'f1-sluse';
  const glow = stats.glow;

  return (
    <group>
      <mesh geometry={body} onClick={select} onPointerOver={over} onPointerOut={() => onHover(null)} castShadow receiveShadow>
        {glass ? (
          <meshPhysicalMaterial
            color="#a8dcff" transparent opacity={0.28} roughness={0.05} metalness={0.1}
            emissive={glow ? C.amber : C.cyan} emissiveIntensity={glow ? 0.25 + glow * 0.5 : selected ? 0.35 : 0.04}
            depthWrite={false}
          />
        ) : (
          <meshStandardMaterial
            color={accent ? C.accent : (floor.id === 'basement' ? C.claddingDark : C.cladding)}
            roughness={0.85}
            emissive={C.cyan}
            emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0}
          />
        )}
      </mesh>
      {!glass && room.kind !== 'garage' && room.kind !== 'storage' && room.kind !== 'tech' && (
        <mesh geometry={band} position={[0, 0.85, 0]} raycast={() => null}>
          <meshStandardMaterial
            color={glow ? '#ffd9a0' : '#6f8fae'}
            emissive={glow ? C.amber : '#0a1a2a'}
            emissiveIntensity={glow ? 0.4 + glow * 1.2 : 0.3}
            transparent
            opacity={glow ? 0.85 : 0.55}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

function GarageDoor() {
  // Port mot vest på dobbelgarasjen (fasade mot vest, tegn. 756-006)
  return (
    <mesh position={[-13.6 - 0.18, FLOORS[1].level + 1.15, -1.0]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
      <planeGeometry args={[5.0, 2.2]} />
      <meshStandardMaterial color="#e9edf2" roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── BIM-modell (GLB) ───────────────────────────────────────────────────

const BIM_GROUP_FLOOR = { basement: 'basement', floor1: 'floor1', floor2: 'floor2' };
const CLIP_HEIGHT = 1.35;   // dukkehus-snitt over gulv i interiør-modus

/** Deler GLB-scenen i grupper (basement/floor1/floor2/roof/site) én gang. */
function useBimGroups() {
  const gltf = useGLTF(BIM_MODEL_URL, false, false);  // ingen Draco/Meshopt: CSP tillater ikke WASM
  return useMemo(() => {
    const groups = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const [grp = 'site', type = '', , gid = '', mi = ''] = (o.name || o.parent?.name || '').split('|');
      (groups[grp] ||= []).push({ mesh: o, type, gid, mi: Number(mi) });
    });
    return groups;
  }, [gltf]);
}

function doorIdOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData?.doorId) return o.userData.doorId;
  return null;
}

function BimGroup({ items, offsetY = 0, clipY = null, interior, onPick, onDoor, dim = 1, doorIndex, registry }) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const plane = clipY == null ? null : new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY);
    const moving = new Map();
    for (const { mesh, type, gid, mi } of items) {
      // I interiør skjules tak/dekker over snittet og terreng; gulvplater tegnes av rommene
      if (interior && (type === 'IfcSlab' || type === 'IfcRoof' || type === 'IfcCovering')) continue;
      const m = mesh.clone();
      m.matrix.copy(mesh.matrixWorld);
      m.matrix.decompose(m.position, m.quaternion, m.scale);
      const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const mat = src.clone();
      if (dim !== 1 && mat.color) mat.color.multiplyScalar(dim);
      if (interior) {
        mat.clippingPlanes = plane ? [plane] : null;
        mat.clipShadows = true;
        if (mat.color) mat.color.multiplyScalar(0.55);
      }
      mat.side = THREE.DoubleSide;
      m.material = mat;
      m.castShadow = !mat.transparent;
      m.receiveShadow = true;
      m.userData.ifcType = type;
      if (type === 'IfcDoor' && gid) {
        m.userData.doorId = gid;
        const meta = doorIndex?.get(gid);
        if (meta && meta.moving.includes(mi)) {
          if (!moving.has(gid)) moving.set(gid, []);
          moving.get(gid).push(m);
        }
      }
      g.add(m);
    }
    // Dørblad/port legges i en pivot i hengselen så de kan åpnes
    g.updateMatrixWorld(true);
    const pivots = [];
    for (const [gid, meshes] of moving) {
      const meta = doorIndex.get(gid);
      const pivot = new THREE.Group();
      pivot.rotation.order = 'YXZ';
      pivot.position.set(...meta.pivot);
      pivot.rotation.y = meta.yaw;
      pivot.userData.doorId = gid;
      g.add(pivot);
      pivot.updateMatrixWorld(true);
      for (const mm of meshes) pivot.attach(mm);
      pivots.push({ id: gid, pivot, meta, mats: meshes.map(mm => mm.material), v: 0 });
    }
    g.userData.doorPivots = pivots;
    return g;
  }, [items, clipY, interior, dim, doorIndex]);

  useEffect(() => {
    if (!registry) return undefined;
    const added = [];
    for (const e of group.userData.doorPivots || []) {
      const list = registry.current.get(e.id) || [];
      list.push(e);
      registry.current.set(e.id, list);
      added.push(e);
    }
    return () => {
      for (const e of added) {
        const list = (registry.current.get(e.id) || []).filter(x => x !== e);
        if (list.length) registry.current.set(e.id, list); else registry.current.delete(e.id);
      }
    };
  }, [group, registry]);
  useEffect(() => () => group.traverse((o) => o.isMesh && o.material.dispose()), [group]);

  const handle = (onPick || onDoor) ? (e) => {
    const doorId = doorIdOf(e.object);
    if (doorId && onDoor) { e.stopPropagation(); onDoor(doorId); return; }
    if (onPick) { e.stopPropagation(); onPick(e.point); }
  } : undefined;
  return <primitive object={group} position={[0, offsetY, 0]} onClick={handle} />;
}

/** Hele bygget/tomta (eksteriør) eller én etasje med snitt (interiør). */
function BimModel({ mode, visibleFloors, floorY, onPick, onDoor, doorIndex, registry }) {
  const groups = useBimGroups();
  if (mode === 'exterior') {
    return (
      <group>
        {['site', 'basement', 'floor1', 'floor2', 'roof'].map(k => groups[k] && (
          <BimGroup
            key={k} items={groups[k]} onPick={k === 'site' ? undefined : onPick} onDoor={onDoor}
            dim={k === 'site' ? 0.42 : 0.9} doorIndex={doorIndex} registry={registry}
          />
        ))}
      </group>
    );
  }
  return (
    <group>
      {visibleFloors.map((floor) => {
        const items = groups[BIM_GROUP_FLOOR[floor.id]];
        if (!items) return null;
        const y = floorY(floor.id);
        return (
          <BimGroup
            key={floor.id} items={items} offsetY={y - floor.level} clipY={y + CLIP_HEIGHT} interior
            onDoor={onDoor} doorIndex={doorIndex} registry={registry}
          />
        );
      })}
    </group>
  );
}

class BimBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('BIM-modell kunne ikke lastes, bruker forenklet modell', err); this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Lys som gløder ut gjennom vinduene i eksteriør-modus. */
function ExteriorGlow({ roomData }) {
  return (
    <group raycast={() => null}>
      {FLOORS.flatMap(floor => floor.rooms.map(room => {
        const { stats } = roomData.byRoom[room.id];
        if (room.outdoor || !stats.lightsOn) return null;
        const [cx, cz] = roomCenter(room);
        return (
          <group key={room.id} position={[cx, floor.level + 1.3, cz]}>
            <pointLight color={C.amber} intensity={2 + stats.glow * 6} distance={6} decay={2} />
            <mesh raycast={() => null}>
              <sphereGeometry args={[0.5, 16, 12]} />
              <meshBasicMaterial color={C.amber} transparent opacity={0.18 + stats.glow * 0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        );
      }))}
    </group>
  );
}

// ─── Etasje ─────────────────────────────────────────────────────────────

function Floor({ floor, index, mode, explode, roomData, overlay, selectedRoomId, hoveredRoomId, onSelect, onHover, isolated, dimmed, bim }) {
  const y = floor.level + (mode === 'interior' ? explode * index * 3.2 : 0);
  return (
    <group position={[0, y, 0]}>
      {floor.rooms.map(room => {
        const data = roomData.byRoom[room.id];
        if (mode === 'exterior' && bim) return null;
        return mode === 'interior' ? (
          <InteriorRoom
            key={room.id}
            data={data}
            overlay={overlay}
            selected={selectedRoomId === room.id}
            hovered={hoveredRoomId === room.id}
            onSelect={onSelect}
            onHover={onHover}
            showLabel={isolated}
            floorHeight={floor.height}
          />
        ) : (
          <ExteriorRoom
            key={room.id}
            data={data}
            floor={floor}
            selected={selectedRoomId === room.id}
            hovered={hoveredRoomId === room.id}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}

      {mode === 'interior' && !bim && (floor.stairs || []).map((s, i) => (
        <Stairs key={i} rect={s} height={floor.height} />
      ))}

      {mode === 'exterior' && !bim && (floor.roofs || []).map((r, i) => (
        <mesh key={i} position={[(r[0] + r[2]) / 2, -0.05, (r[1] + r[3]) / 2]} raycast={() => null} receiveShadow>
          <boxGeometry args={[r[2] - r[0] + 0.3, 0.12, r[3] - r[1] + 0.3]} />
          <meshStandardMaterial color="#3a3f47" roughness={0.95} />
        </mesh>
      ))}

      {dimmed && (
        <mesh position={[CENTER[0], 0.6, CENTER[2]]} raycast={() => null}>
          <boxGeometry args={[26, 1.4, 14]} />
          <meshBasicMaterial color={C.bg} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function Stairs({ rect, height }) {
  const [x0, z0, x1, z1] = rect;
  const alongX = (x1 - x0) >= (z1 - z0);
  const steps = 8;
  return (
    <group raycast={() => null}>
      {Array.from({ length: steps }).map((_, i) => {
        const t = i / steps;
        const h = 0.12 + (height * 0.5) * (i + 1) / steps;
        const pos = alongX
          ? [x0 + (x1 - x0) * (t + 0.5 / steps), h / 2, (z0 + z1) / 2]
          : [(x0 + x1) / 2, h / 2, z0 + (z1 - z0) * (t + 0.5 / steps)];
        const size = alongX ? [(x1 - x0) / steps, h, (z1 - z0) * 0.9] : [(x1 - x0) * 0.9, h, (z1 - z0) / steps];
        return (
          <mesh key={i} position={pos} raycast={() => null}>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#1b2b45" transparent opacity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Enhets-pins i 3D ───────────────────────────────────────────────────

// ─── Kamera ─────────────────────────────────────────────────────────────

const PRESETS = {
  iso:   { pos: [16, 20, 26],   target: [CENTER[0], 3, CENTER[2]] },
  top:   { pos: [CENTER[0], 38, CENTER[2] + 0.01], target: [CENTER[0], 0, CENTER[2]] },
  south: { pos: [CENTER[0], 7, 30], target: [CENTER[0], 4, CENTER[2]] },
  west:  { pos: [-34, 9, 4],    target: [CENTER[0], 4, CENTER[2]] },
  sea:   { pos: [28, 10, 8],    target: [CENTER[0], 4, CENTER[2]] }
};

function CameraRig({ flyTo, controlsRef }) {
  const { camera } = useThree();
  const anim = useRef(null);
  useEffect(() => {
    if (!flyTo) return;
    anim.current = {
      pos: new THREE.Vector3(...flyTo.pos),
      target: new THREE.Vector3(...flyTo.target)
    };
  }, [flyTo]);
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const stop = () => { anim.current = null; };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controlsRef]);
  useFrame((_, dt) => {
    const a = anim.current;
    const c = controlsRef.current;
    if (!a || !c) return;
    const k = 1 - Math.pow(0.0025, dt);
    camera.position.lerp(a.pos, k);
    c.target.lerp(a.target, k);
    c.update();
    if (camera.position.distanceTo(a.pos) < 0.05 && c.target.distanceTo(a.target) < 0.05) anim.current = null;
  });
  return null;
}

function Ground({ mode }) {
  const y = mode === 'exterior' ? 1.67 : -0.02;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER[0], y - 0.01, CENTER[2]]} receiveShadow raycast={() => null}>
        <circleGeometry args={[48, 64]} />
        <meshStandardMaterial color={mode === 'exterior' ? '#0c1626' : '#070b14'} roughness={1} transparent opacity={mode === 'exterior' ? 0.94 : 1} />
      </mesh>
      <gridHelper args={[96, 96, '#163050', '#0d1a2c']} position={[CENTER[0], y, CENTER[2]]} />
    </group>
  );
}

// ─── Hovedvisning ───────────────────────────────────────────────────────

export function House3DView({ devices, zones, onSetCapability, floorPlanPins }) {
  const roomsCfg = useHouse3dRooms();
  const groupCommand = useDeviceCommand();
  const [mode, setMode] = useState('interior');
  const [floorFilter, setFloorFilter] = useState('all');
  const [overlay, setOverlay] = useState('all');
  const [explode, setExplode] = useState(0.6);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [bimOn, setBimOn] = useState(true);
  const [bimFailed, setBimFailed] = useState(false);
  const bim = bimOn && !bimFailed;
  const controlsRef = useRef();

  const roomData = useRoomData(devices, zones, roomsCfg.config, floorPlanPins);
  const doorMeta = useDoorMeta();
  const doorsCfg = useHouse3dDoors();
  const doorIndex = useMemo(() => new Map(doorMeta.map(d => [d.id, d])), [doorMeta]);
  const doorRegistry = useRef(new Map());
  const [selectedDoorId, setSelectedDoorId] = useState(null);
  const doorLinks = useMemo(
    () => resolveDoorLinks(doorMeta, devices, doorsCfg.config, roomData.markers),
    [doorMeta, devices, doorsCfg.config, roomData.markers]
  );
  const doorOpen = useMemo(() => {
    const out = {};
    for (const [doorId, devId] of Object.entries(doorLinks.links)) out[doorId] = devId ? doorSensorOpen(devices?.[devId]) : null;
    return out;
  }, [doorLinks, devices]);
  const doorByDevice = useMemo(() => {
    const out = {};
    for (const [doorId, devId] of Object.entries(doorLinks.links)) if (devId) out[devId] = doorIndex.get(doorId);
    return out;
  }, [doorLinks, doorIndex]);
  const openDoors = doorMeta.filter(d => doorOpen[d.id] === true);

  // Enhetsmarkører: pins fra plantegningene, dørsensorer flyttes til døra de er koblet til
  const markers3d = useMemo(() => {
    const list = roomData.markers.map(m => {
      const door = doorByDevice[m.device.id];
      return door ? { ...m, x: door.center[0], z: door.center[2], floorId: door.floor } : m;
    });
    const pinned = new Set(list.map(m => m.device.id));
    for (const [devId, door] of Object.entries(doorByDevice)) {
      if (!door || pinned.has(devId) || !devices?.[devId]) continue;
      list.push({ id: `door-${door.id}`, floorId: door.floor, x: door.center[0], z: door.center[2], device: devices[devId], label: door.label, roomId: null });
    }
    return list;
  }, [roomData.markers, doorByDevice, devices]);

  // Lyskilder: pin-posisjon i taket, ellers rommets sentrum
  const lightSources = useMemo(() => {
    const out = [];
    const pinPos = new Map(roomData.markers.map(m => [m.device.id, m]));
    for (const floor of FLOORS) {
      for (const room of floor.rooms) {
        const data = roomData.byRoom[room.id];
        const lights = data.devices.filter(isLightDevice);
        lights.forEach((d, i) => {
          const r = deviceReadout(d);
          const pin = pinPos.get(d.id);
          const [cx, cz] = roomCenter(room);
          const spread = lights.length > 1 && !pin ? 0.8 : 0;
          out.push({
            key: `${room.id}-${d.id}`, floorId: floor.id, ceiling: floor.height,
            x: pin ? pin.x : cx + spread * Math.cos((i / lights.length) * Math.PI * 2),
            z: pin ? pin.z : cz + spread * Math.sin((i / lights.length) * Math.PI * 2),
            level: r.level || 0
          });
        });
      }
    }
    return out;
  }, [roomData]);

  // Pins som ligger i et annet rom enn Homey-sonen tilsier
  const placementIssues = useMemo(() => {
    const zoneRooms = {};
    for (const { room, zoneIds } of Object.values(roomData.byRoom)) {
      for (const z of zoneDescendants(zoneIds, zones)) (zoneRooms[z] ||= new Set()).add(room.id);
    }
    return roomData.markers.filter(m => {
      const zr = m.device.zone ? zoneRooms[m.device.zone] : null;
      if (!m.roomId) return true;
      return zr && zr.size > 0 && !zr.has(m.roomId);
    }).map(m => ({
      marker: m,
      pinRoom: ALL_ROOMS.find(r => r.id === m.roomId)?.name || 'utenfor rom',
      zoneRoom: [...(zoneRooms[m.device.zone] || [])].map(id => ALL_ROOMS.find(r => r.id === id)?.name).filter(Boolean).join(', ')
    }));
  }, [roomData, zones]);

  const floorIndex = floorFilter === 'all' ? FLOORS.length - 1 : FLOORS.findIndex(f => f.id === floorFilter);
  const visibleFloors = FLOORS.filter((_, i) => i <= floorIndex);
  const selectedRoom = selectedRoomId ? roomData.byRoom[selectedRoomId] : null;
  const selectedMarker = markers3d.find(m => m.id === selectedMarkerId) || null;
  const selectedDoor = selectedDoorId ? doorIndex.get(selectedDoorId) : null;

  const floorY = (floorId) => {
    const i = FLOORS.findIndex(f => f.id === floorId);
    return FLOORS[i].level + (mode === 'interior' ? explode * i * 3.2 : 0);
  };

  const selectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    setSelectedMarkerId(null);
    setSelectedDoorId(null);
    if (!roomId) return;
    const room = ALL_ROOMS.find(r => r.id === roomId);
    const [x, z] = roomCenter(room);
    const y = floorY(room.floorId);
    setFlyTo({ pos: [x + 7, y + 9, z + 10], target: [x, y + 0.8, z], key: Date.now() });
  };

  const selectDoor = (doorId) => {
    setSelectedDoorId(doorId);
    setSelectedRoomId(null);
    setSelectedMarkerId(null);
    const door = doorIndex.get(doorId);
    if (!door) return;
    let nx = -Math.sin(door.yaw), nz = -Math.cos(door.yaw);
    if (nx * (door.center[0] - CENTER[0]) + nz * (door.center[2] - CENTER[2]) < 0) { nx = -nx; nz = -nz; }
    if (door.kind === 'garage') {
      // Garasjeporten vises utenfra (porten vipper opp i taket)
      setMode('exterior');
      setFloorFilter('all');
      setFlyTo({ pos: [door.center[0] + nx * 10, 5.5, door.center[2] + nz * 10 + 2], target: [door.center[0], 3.6, door.center[2]], key: Date.now() });
      return;
    }
    // Andre dører: vis etasjen alene i snitt, sett skrått ovenfra – ingen vegger i veien
    const i = FLOORS.findIndex(f => f.id === door.floor);
    setMode('interior');
    setFloorFilter(door.floor);
    const y = FLOORS[i].level + explode * i * 3.2;
    setFlyTo({ pos: [door.center[0] + nx * 5.5, y + 9, door.center[2] + nz * 5.5 + 2.5], target: [door.center[0], y + 0.6, door.center[2]], key: Date.now() });
  };

  // Klikk på BIM-geometri → finn rommet under punktet
  const pickPoint = (p) => {
    const lv = (id) => FLOORS.find(f => f.id === id).level;
    const floorId = p.y < lv('floor1') - 0.2 ? 'basement' : p.y < lv('floor2') - 0.2 ? 'floor1' : 'floor2';
    const floor = FLOORS.find(f => f.id === floorId);
    const room = floor.rooms.find(r => pointInPoly([p.x, p.z], roomPoly(r)))
      || FLOORS.flatMap(f => f.rooms).find(r => pointInPoly([p.x, p.z], roomPoly(r)));
    if (room) selectRoom(room.id);
  };

  const selectFloor = (id) => {
    setFloorFilter(id);
    if (id !== 'all') {
      setMode('interior');
      const i = FLOORS.findIndex(f => f.id === id);
      const y = FLOORS[i].level + explode * i * 3.2;
      setFlyTo({ pos: [CENTER[0] + 6, y + 22, CENTER[2] + 16], target: [CENTER[0], y, CENTER[2]], key: Date.now() });
    }
  };

  const setAllLights = (devs, on) => groupCommand.run(async () => {
    let confirmed = true;
    for (const d of devs) {
      if (!isLight(d) || !hasCap(d, 'onoff') || capValue(d, 'onoff') === on) continue;
      if (!canWrite(d, 'onoff')) throw new Error(`${d.name} er utilgjengelig eller skrivebeskyttet`);
      const result = await onSetCapability(d.id, 'onoff', on);
      if (result?.ok === false) throw new Error(`${d.name}: ${result.error}. Resterende lys ble ikke styrt.`);
      confirmed = confirmed && result?.confirmed === true;
    }
    return { ok: true, confirmed };
  });

  // Totalstatus for topplinja
  const totals = useMemo(() => {
    let lightsOn = 0, lights = 0, motion = 0;
    for (const r of Object.values(roomData.byRoom)) {
      lightsOn += r.stats.lightsOn; lights += r.stats.lights; if (r.stats.motion) motion++;
    }
    return { lightsOn, lights, motion };
  }, [roomData]);

  return (
    <div>
      <DeviceCommandStatus command={groupCommand} />
      <header className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="panel-title">3D-modell</h2>
          <p className="mt-1 text-xl font-semibold">Hus · Hunstein 48c</p>
          <p className="mt-0.5 text-xs text-nx-mute font-mono">
            {bim ? 'BIM-modell (som bygget)' : 'Forenklet modell fra arkitekttegninger'} · {ALL_ROOMS.length} rom · 3 etasjer ·{' '}
            <span className="text-nx-amber">{totals.lightsOn}/{totals.lights} lys på</span>
            {totals.motion > 0 && <span className="text-nx-red"> · bevegelse i {totals.motion} rom</span>}
            {openDoors.length > 0 && <span className="text-nx-amber"> · {openDoors.length} {openDoors.length === 1 ? 'dør' : 'dører'} åpen</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToggleBtn active={mode === 'exterior'} onClick={() => { setMode('exterior'); setFloorFilter('all'); setFlyTo({ ...PRESETS.iso, key: Date.now() }); }} Icon={HomeIcon}>Eksteriør</ToggleBtn>
          <ToggleBtn active={mode === 'interior'} onClick={() => setMode('interior')} Icon={Box}>Interiør</ToggleBtn>
          {!bimFailed && <ToggleBtn active={bimOn} onClick={() => setBimOn(b => !b)} Icon={Layers}>BIM</ToggleBtn>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-nx-mute mr-1">Etasje</span>
        <ToggleBtn active={floorFilter === 'all'} onClick={() => selectFloor('all')} Icon={Layers}>Alle</ToggleBtn>
        {FLOORS.map(f => (
          <ToggleBtn key={f.id} active={floorFilter === f.id} onClick={() => selectFloor(f.id)}>{f.label}</ToggleBtn>
        ))}
        <span className="mx-2 h-4 w-px bg-nx-line" aria-hidden="true" />
        {OVERLAYS.map(o => (
          <ToggleBtn key={o.id} active={overlay === o.id} onClick={() => setOverlay(o.id)} Icon={o.Icon} subtle>{o.label}</ToggleBtn>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <SaveButton sync={selectedDoor ? doorsCfg.sync : roomsCfg.sync} size="sm" />
          <ToggleBtn active={editing} onClick={() => setEditing(e => !e)} Icon={Edit2}>{editing ? 'Ferdig' : 'Koble rom/dører'}</ToggleBtn>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 items-stretch">
        <div
          className="relative flex-1 min-w-0 overflow-hidden rounded-xl border border-nx-line/60 bg-nx-bg"
          style={{ height: 'calc(100vh - 300px)', minHeight: 480, maxHeight: 900 }}
        >
          <Canvas
            shadows
            gl={{ localClippingEnabled: true }}
            dpr={[1, 2]}
            camera={{ position: PRESETS.iso.pos, fov: 40, near: 0.1, far: 400 }}
            onPointerMissed={() => { setSelectedRoomId(null); setSelectedMarkerId(null); setSelectedDoorId(null); }}
          >
            <color attach="background" args={[C.bg]} />
            <fog attach="fog" args={[C.bg, 45, 120]} />
            <ambientLight intensity={mode === 'exterior' ? 0.45 : 0.55} />
            <hemisphereLight args={['#8fdcff', '#05070d', 0.35]} />
            <directionalLight
              position={[18, 30, 14]}
              intensity={mode === 'exterior' ? 1.4 : 0.9}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-30}
              shadow-camera-right={30}
              shadow-camera-top={30}
              shadow-camera-bottom={-30}
            />
            <directionalLight position={[-20, 12, -10]} intensity={0.25} color="#7d5cff" />

            <Suspense fallback={null}>
              {!(bim && mode === 'exterior') && <Ground mode={mode} />}
              {bimOn && !bimFailed && (
                <BimBoundary onFail={() => setBimFailed(true)}>
                  <Suspense fallback={null}>
                    <BimModel
                      mode={mode} visibleFloors={visibleFloors} floorY={floorY} onPick={pickPoint}
                      onDoor={selectDoor} doorIndex={doorIndex} registry={doorRegistry}
                    />
                  </Suspense>
                </BimBoundary>
              )}
              {bim && <DoorAnimator registry={doorRegistry} openState={doorOpen} />}
              {bim && mode === 'exterior' && <ExteriorGlow roomData={roomData} />}
              {overlay !== 'temp' && overlay !== 'security' && (
                <RoomLighting
                  lights={lightSources
                    .filter(l => mode === 'exterior' || visibleFloors.some(f => f.id === l.floorId))
                    .map(l => ({ ...l, y: floorY(l.floorId) + (mode === 'interior' ? Math.min(l.ceiling - 0.1, CLIP_HEIGHT + 0.6) : l.ceiling - 0.1) }))}
                />
              )}
              {mode === 'interior' && overlay !== 'temp' && overlay !== 'security' && visibleFloors.flatMap(floor =>
                floor.rooms.filter(r => !r.outdoor).map(room => {
                  const st = roomData.byRoom[room.id].stats;
                  return st.lightsOn > 0 ? (
                    <group key={`vol-${room.id}`} position={[0, floorY(floor.id), 0]}>
                      <RoomLightVolume poly={roomPoly(room)} height={CLIP_HEIGHT - 0.15} level={st.glow} />
                    </group>
                  ) : null;
                }))}
              {visibleFloors.map((floor) => {
                const i = FLOORS.indexOf(floor);
                return (
                  <Floor
                    key={floor.id}
                    floor={floor}
                    index={i}
                    mode={mode}
                    explode={explode}
                    roomData={roomData}
                    overlay={overlay}
                    selectedRoomId={selectedRoomId}
                    hoveredRoomId={hoveredRoomId}
                    onSelect={selectRoom}
                    onHover={setHoveredRoomId}
                    isolated={floorFilter === floor.id}
                    dimmed={floorFilter !== 'all' && floorFilter !== floor.id && mode === 'interior'}
                    bim={bim}
                  />
                );
              })}
              {mode === 'exterior' && !bim && <GarageDoor />}
              {mode === 'interior' && markers3d
                .filter(m => visibleFloors.some(f => f.id === m.floorId))
                .filter(m => overlay === 'all'
                  || (overlay === 'light' && isLight(m.device))
                  || (overlay === 'temp' && (hasCap(m.device, 'measure_temperature') || hasCap(m.device, 'target_temperature')))
                  || (overlay === 'security' && (hasCap(m.device, 'alarm_motion') || isDoorSensor(m.device) || hasCap(m.device, 'locked') || m.device.class === 'camera')))
                .map(m => {
                  const floor = FLOORS.find(f => f.id === m.floorId);
                  const door = doorByDevice[m.device.id];
                  return (
                    <DeviceMarker3D
                      key={m.id}
                      marker={m}
                      baseY={floorY(m.floorId)}
                      ceiling={floor.height}
                      selected={selectedMarkerId === m.id}
                      doorOpen={door ? doorOpen[door.id] : undefined}
                      showValue={overlay !== 'all' || floorFilter !== 'all'}
                      onSelect={(mk) => { setSelectedMarkerId(mk.id); setSelectedRoomId(mk.roomId); setSelectedDoorId(null); }}
                    />
                  );
                })}
            </Suspense>

            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.08}
              target={PRESETS.iso.target}
              maxPolarAngle={Math.PI / 2.02}
              minDistance={4}
              maxDistance={90}
              autoRotate={autoRotate}
              autoRotateSpeed={0.6}
            />
            <CameraRig flyTo={flyTo} controlsRef={controlsRef} />
          </Canvas>

          {/* Overlay-kontroller i canvaset */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
            <div className="pointer-events-auto flex flex-wrap gap-1">
              {[['iso', 'ISO'], ['top', 'Topp'], ['south', 'Sør'], ['west', 'Vest'], ['sea', 'Sjø']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFlyTo({ ...PRESETS[id], key: Date.now() })}
                  className="rounded border border-nx-line/70 bg-nx-bg/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute backdrop-blur hover:border-nx-cyan/50 hover:text-nx-cyan"
                >{label}</button>
              ))}
              <button
                onClick={() => setAutoRotate(a => !a)}
                aria-pressed={autoRotate}
                className={[
                  'inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] backdrop-blur',
                  autoRotate ? 'border-nx-cyan/60 bg-nx-cyan/15 text-nx-cyan' : 'border-nx-line/70 bg-nx-bg/70 text-nx-mute hover:text-nx-cyan'
                ].join(' ')}
              ><RotateCw size={10} /> Roter</button>
            </div>
            {mode === 'interior' && (
              <label className="pointer-events-auto flex items-center gap-2 rounded border border-nx-line/70 bg-nx-bg/70 px-2 py-1 backdrop-blur">
                <Move3d size={12} className="text-nx-mute" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-nx-mute">Spre etasjer</span>
                <input
                  type="range" min={0} max={1} step={0.01} value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))}
                  className="w-24 accent-nx-cyan"
                  aria-label="Spre etasjer"
                />
              </label>
            )}
          </div>

          {overlay === 'temp' && <TempLegend />}

          <p className="pointer-events-none absolute bottom-2 left-2 font-mono text-[10px] text-nx-mute/80">
            Dra for å rotere · scroll for zoom · høyreklikk for å flytte · klikk et rom for å styre det
          </p>
        </div>

        <aside className="xl:w-[360px] shrink-0 panel p-3 overflow-y-auto" style={{ maxHeight: 900 }}>
          {selectedDoor ? (
            <DoorPanel
              door={selectedDoor}
              link={doorLinks.links[selectedDoor.id] ?? null}
              source={doorLinks.source[selectedDoor.id]}
              open={doorOpen[selectedDoor.id]}
              devices={devices}
              editing={editing}
              onLink={(devId) => doorsCfg.link(selectedDoor.id, devId)}
              onReset={() => doorsCfg.reset(selectedDoor.id)}
              onSet={onSetCapability}
              onClose={() => setSelectedDoorId(null)}
            />
          ) : selectedMarker && !editing ? (
            <MarkerPanel marker={selectedMarker} onSet={onSetCapability} onClose={() => setSelectedMarkerId(null)} />
          ) : selectedRoom ? (
            <RoomPanel
              data={selectedRoom}
              zones={zones}
              editing={editing}
              onSet={onSetCapability}
              onAllLights={setAllLights} groupPending={groupCommand.pending}
              onClose={() => selectRoom(null)}
              onToggleZone={(zoneId) => roomsCfg.toggleZone(selectedRoom.room.id, zoneId, selectedRoom.zoneIds)}
              onResetZones={() => roomsCfg.resetRoom(selectedRoom.room.id)}
            />
          ) : (
            <Overview
              roomData={roomData} onSelect={selectRoom} onAllLights={setAllLights} groupPending={groupCommand.pending}
              doors={doorMeta} doorLinks={doorLinks} doorOpen={doorOpen} devices={devices} onSelectDoor={selectDoor}
              placementIssues={placementIssues}
              onSelectMarker={(m) => { setSelectedMarkerId(m.id); setSelectedRoomId(m.roomId); setSelectedDoorId(null); }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Sidepanel ──────────────────────────────────────────────────────────

function Overview({ roomData, onSelect, onAllLights, groupPending, doors = [], doorLinks, doorOpen = {}, devices, onSelectDoor, placementIssues = [], onSelectMarker }) {
  const linked = doors.filter(d => doorLinks?.links[d.id]);
  const shown = [...linked].sort((a, b) => (doorOpen[b.id] === true) - (doorOpen[a.id] === true) || a.label.localeCompare(b.label, 'nb'));
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-nx-line/60 bg-nx-panel/40">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-nx-line/50">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-nx-cyan">Dører og port</span>
          <span className="font-mono text-[10px] text-nx-mute">{linked.length}/{doors.length} koblet</span>
        </div>
        <ul className="divide-y divide-nx-line/40">
          {shown.map(d => {
            const o = doorOpen[d.id];
            return (
              <li key={d.id}>
                <button onClick={() => onSelectDoor(d.id)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-nx-cyan/5">
                  <DoorOpen size={11} className={o === true ? 'text-nx-amber' : o === false ? 'text-nx-green' : 'text-nx-mute'} aria-hidden="true" />
                  <span className="flex-1 truncate">{d.label}</span>
                  <span className={`font-mono text-[10px] ${o === true ? 'text-nx-amber' : o === false ? 'text-nx-green' : 'text-nx-mute'}`}>
                    {o === true ? 'Åpen' : o === false ? 'Lukket' : '—'}
                  </span>
                  <ChevronRight size={12} className="text-nx-mute" aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="px-2.5 py-2 text-[11px] text-nx-mute">
              Ingen dørsensorer koblet ennå. Klikk en dør i modellen og velg «Koble rom/dører».
            </li>
          )}
        </ul>
      </div>
      {placementIssues.length > 0 && (
        <div className="rounded-lg border border-nx-amber/40 bg-nx-panel/40">
          <div className="px-2.5 py-1.5 border-b border-nx-line/50 font-mono text-[11px] uppercase tracking-[0.18em] text-nx-amber">
            Plassering å sjekke ({placementIssues.length})
          </div>
          <ul className="divide-y divide-nx-line/40">
            {placementIssues.map(({ marker, pinRoom, zoneRoom }) => (
              <li key={marker.id}>
                <button onClick={() => onSelectMarker(marker)} className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-nx-cyan/5">
                  <span className="block truncate">{marker.label || marker.device.name}</span>
                  <span className="block font-mono text-[10px] text-nx-mute">
                    pin i {pinRoom}{zoneRoom ? ` · Homey-sone: ${zoneRoom}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="panel-title">Rom</p>
      {[...FLOORS].reverse().map(f => {
        const rooms = f.rooms.map(r => roomData.byRoom[r.id]);
        const devs = rooms.flatMap(r => r.devices);
        const on = rooms.reduce((s, r) => s + r.stats.lightsOn, 0);
        const total = rooms.reduce((s, r) => s + r.stats.lights, 0);
        return (
          <div key={f.id} className="rounded-lg border border-nx-line/60 bg-nx-panel/40">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-nx-line/50">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-nx-cyan">{f.label}</span>
              {total > 0 && (
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-nx-amber mr-1">{on}/{total}</span>
                  <MiniBtn disabled={groupPending} onClick={() => onAllLights(devs, true)} title={`Alle lys på i ${f.label}`}><Lightbulb size={10} /> På</MiniBtn>
                  <MiniBtn disabled={groupPending} onClick={() => onAllLights(devs, false)} title={`Alle lys av i ${f.label}`}><Power size={10} /> Av</MiniBtn>
                </span>
              )}
            </div>
            <ul className="divide-y divide-nx-line/40">
              {rooms.map(({ room, stats, devices }) => (
                <li key={room.id}>
                  <button
                    onClick={() => onSelect(room.id)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-nx-cyan/5"
                  >
                    <span className="flex-1 truncate">{room.name}</span>
                    {Number.isFinite(stats.temp) && <span className="font-mono text-[10px] text-nx-cyan">{stats.temp.toFixed(1)}°</span>}
                    {stats.lightsOn > 0 && <Lightbulb size={11} className="text-nx-amber" aria-label="lys på" />}
                    {stats.motion && <Activity size={11} className="text-nx-red" aria-label="bevegelse" />}
                    {stats.open && <DoorOpen size={11} className="text-nx-amber" aria-label="åpen" />}
                    <span className="font-mono text-[10px] text-nx-mute w-8 text-right">{devices.length || ''}</span>
                    <ChevronRight size={12} className="text-nx-mute" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-[10px] text-nx-mute leading-relaxed">
        Rom kobles automatisk mot Homey-soner med samme navn, og mot pins du har plassert på 2D-plantegningene.
        Bruk «Koble rom» for å velge soner manuelt.
      </p>
    </div>
  );
}

function RoomPanel({ data, zones, editing, onSet, onAllLights, onClose, onToggleZone, onResetZones, groupPending }) {
  const { room, stats, devices, zoneIds, manual } = data;
  const floor = FLOORS.find(f => f.rooms.some(r => r.id === room.id));
  const [openId, setOpenId] = useState(null);
  const lights = devices.filter(d => isLight(d) && hasCap(d, 'onoff'));
  const thermostats = devices.filter(d => hasCap(d, 'target_temperature'));
  const others = devices.filter(d => !lights.includes(d) && !thermostats.includes(d));
  const zoneList = Object.values(zones || {}).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nb'));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="panel-title">{floor?.label}</p>
          <h3 className="mt-1 text-lg font-semibold">{room.name}</h3>
          <p className="font-mono text-[10px] text-nx-mute">
            {roomArea(room).toFixed(1)} m² · {devices.length} enheter
            {zoneIds.length > 0 && ` · ${zoneIds.map(id => zones?.[id]?.name).filter(Boolean).join(', ')}`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Lukk" className="text-nx-mute hover:text-nx-cyan"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Temp" value={Number.isFinite(stats.temp) ? `${stats.temp.toFixed(1)}°` : '—'} tone="cyan" />
        <Stat label="Lys" value={stats.lights ? `${stats.lightsOn}/${stats.lights}` : '—'} tone={stats.lightsOn ? 'amber' : 'mute'} />
        <Stat label="Status" value={stats.motion ? 'Bevegelse' : stats.open ? 'Åpen' : 'Rolig'} tone={stats.motion ? 'red' : stats.open ? 'amber' : 'green'} />
      </div>

      {editing && (
        <div className="rounded-lg border border-nx-cyan/30 p-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-cyan">Homey-soner for rommet</p>
            {manual && <button onClick={onResetZones} className="font-mono text-[10px] text-nx-mute hover:text-nx-cyan">Auto</button>}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {zoneList.map(z => (
              <label key={z.id} className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-nx-panel/60 cursor-pointer">
                <input type="checkbox" checked={zoneIds.includes(z.id)} onChange={() => onToggleZone(z.id)} className="accent-nx-cyan" />
                <span className="truncate">{z.name}</span>
              </label>
            ))}
            {zoneList.length === 0 && <p className="text-[11px] text-nx-mute">Ingen soner fra Homey.</p>}
          </div>
          <p className="mt-1.5 text-[10px] text-nx-mute">{manual ? 'Manuell kobling' : 'Automatisk koblet etter navn'} · husk å lagre.</p>
        </div>
      )}

      {lights.length > 0 && (
        <Section title={`Lys (${stats.lightsOn}/${lights.length})`} actions={
          <>
            <MiniBtn disabled={groupPending} onClick={() => onAllLights(lights, true)}><Lightbulb size={10} /> Alle på</MiniBtn>
            <MiniBtn disabled={groupPending} onClick={() => onAllLights(lights, false)}><Power size={10} /> Alle av</MiniBtn>
          </>
        }>
          {lights.map(d => <DeviceRow key={d.id} device={d} open={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} onSet={onSet} />)}
        </Section>
      )}

      {thermostats.length > 0 && (
        <Section title="Varme">
          {thermostats.map(d => <DeviceRow key={d.id} device={d} open={openId === d.id || thermostats.length === 1} onToggle={() => setOpenId(openId === d.id ? null : d.id)} onSet={onSet} />)}
        </Section>
      )}

      {others.length > 0 && (
        <Section title="Andre enheter">
          {others.map(d => <DeviceRow key={d.id} device={d} open={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} onSet={onSet} />)}
        </Section>
      )}

      {devices.length === 0 && !editing && (
        <p className="text-xs text-nx-mute leading-relaxed">
          Ingen enheter koblet til dette rommet ennå. Trykk «Koble rom» og velg hvilke Homey-soner som hører til,
          eller plasser pins på 2D-plantegningen.
        </p>
      )}
    </div>
  );
}

function DoorPanel({ door, link, source, open, devices, editing, onLink, onReset, onSet, onClose }) {
  const dev = link ? devices?.[link] : null;
  const sensors = Object.values(devices || {}).filter(isDoorSensor)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nb'));
  const kind = door.kind === 'garage' ? 'Leddport' : door.kind === 'slide' ? 'Skyvedør' : 'Slagdør';
  const floorLabel = FLOORS.find(f => f.id === door.floor)?.label;
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="panel-title">{floorLabel} · {kind}</p>
          <h3 className="mt-1 text-lg font-semibold">{door.label}</h3>
          <p className="font-mono text-[10px] text-nx-mute">
            {(door.width * 1000).toFixed(0)} × {(door.height * 1000).toFixed(0)} mm · {door.ifcName}
          </p>
        </div>
        <button onClick={onClose} aria-label="Lukk" className="text-nx-mute hover:text-nx-cyan"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Status" value={open === true ? 'Åpen' : open === false ? 'Lukket' : 'Ukjent'} tone={open === true ? 'amber' : open === false ? 'green' : 'mute'} />
        <Stat label="Sensor" value={dev ? dev.name : '—'} tone={dev ? 'cyan' : 'mute'} />
      </div>
      {source && <p className="font-mono text-[10px] text-nx-mute">Kobling: {source}</p>}
      {dev && !editing && <DeviceControls device={dev} onSet={onSet} />}
      {editing ? (
        <div className="rounded-lg border border-nx-cyan/30 p-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-cyan">Velg sensor for døra</p>
            <button onClick={onReset} className="font-mono text-[10px] text-nx-mute hover:text-nx-cyan">Auto</button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            <label className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-nx-panel/60 cursor-pointer">
              <input type="radio" name="door-sensor" checked={!link && source?.startsWith('manuell')} onChange={() => onLink(null)} className="accent-nx-cyan" />
              <span className="text-nx-mute">Ingen sensor</span>
            </label>
            {sensors.map(sd => {
              const o = doorSensorOpen(sd);
              return (
                <label key={sd.id} className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-nx-panel/60 cursor-pointer">
                  <input type="radio" name="door-sensor" checked={link === sd.id} onChange={() => onLink(sd.id)} className="accent-nx-cyan" />
                  <span className="flex-1 truncate">{sd.name}</span>
                  <span className={`font-mono text-[10px] ${o === true ? 'text-nx-amber' : 'text-nx-mute'}`}>{o === true ? 'åpen' : o === false ? 'lukket' : ''}</span>
                </label>
              );
            })}
            {sensors.length === 0 && <p className="text-[11px] text-nx-mute">Fant ingen dør-/kontaktsensorer i Homey.</p>}
          </div>
          <p className="mt-1.5 text-[10px] text-nx-mute">Tips: åpne døra og se hvilken sensor som viser «åpen». Husk å lagre.</p>
        </div>
      ) : (
        <p className="text-[11px] text-nx-mute leading-relaxed">
          Døra åpnes i modellen når sensoren melder åpen. Trykk «Koble rom/dører» for å velge sensor manuelt.
        </p>
      )}
    </div>
  );
}

function MarkerPanel({ marker, onSet, onClose }) {
  const d = marker.device;
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="panel-title">Enhet</p>
          <h3 className="mt-1 text-lg font-semibold">{marker.label || d.name}</h3>
          <p className="font-mono text-[10px] text-nx-mute">
            {ALL_ROOMS.find(r => r.id === marker.roomId)?.name || 'Utenfor rom'} · {d.class}
          </p>
        </div>
        <button onClick={onClose} aria-label="Lukk" className="text-nx-mute hover:text-nx-cyan"><X size={16} /></button>
      </div>
      <DeviceControls device={d} onSet={onSet} />
    </div>
  );
}

function DeviceRow({ device, open, onToggle, onSet }) {
  const command = useDeviceCommand();
  const on = capValue(device, 'onoff');
  const t = capValue(device, 'measure_temperature');
  const target = capValue(device, 'target_temperature');
  const lockable = hasCap(device, 'locked');
  return (
    <div className="rounded-md border border-nx-line/50 bg-nx-panel/30">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: markerColor(device), boxShadow: `0 0 6px ${markerColor(device)}` }} />
        <button onClick={onToggle} className="flex-1 truncate text-left text-xs hover:text-nx-cyan">{device.name}</button>
        {Number.isFinite(target) && <span className="font-mono text-[10px] text-nx-cyan">{target.toFixed(1)}°</span>}
        {!Number.isFinite(target) && Number.isFinite(t) && <span className="font-mono text-[10px] text-nx-mute">{t.toFixed(1)}°</span>}
        {lockable && (
          <button
            onClick={() => command.run(() => onSet(device.id, 'locked', !capValue(device, 'locked')))}
            disabled={command.pending || !canWrite(device, 'locked')}
            className={capValue(device, 'locked') ? 'text-nx-green' : 'text-nx-amber'}
            aria-label={capValue(device, 'locked') ? 'Lås opp' : 'Lås'}
          >{capValue(device, 'locked') ? <Lock size={13} /> : <Unlock size={13} />}</button>
        )}
        {hasCap(device, 'onoff') && (
          <button
            onClick={() => command.run(() => onSet(device.id, 'onoff', !on))}
            disabled={command.pending || !canWrite(device, 'onoff')}
            role="switch"
            aria-checked={!!on}
            aria-label={`${device.name} av/på`}
            className={['relative h-4 w-7 rounded-full transition-colors', on ? 'bg-nx-amber/80' : 'bg-nx-line'].join(' ')}
          >
            <span className={['absolute top-0.5 h-3 w-3 rounded-full bg-nx-bg transition-all', on ? 'left-3.5' : 'left-0.5'].join(' ')} />
          </button>
        )}
      </div>
      <DeviceCommandStatus command={command} />
      {open && (
        <div className="border-t border-nx-line/40 px-2 py-2">
          <DeviceControls device={device} onSet={onSet} />
        </div>
      )}
    </div>
  );
}

function Section({ title, actions, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nx-mute">{title}</p>
        {actions && <div className="flex gap-1">{actions}</div>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const color = { cyan: 'text-nx-cyan', amber: 'text-nx-amber', red: 'text-nx-red', green: 'text-nx-green', mute: 'text-nx-mute' }[tone];
  return (
    <div className="rounded-lg border border-nx-line/60 bg-nx-panel/40 px-2 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-nx-mute">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${color}`}>{value}</p>
    </div>
  );
}

function MiniBtn({ children, ...props }) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-1 rounded border border-nx-line/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-nx-mute hover:border-nx-cyan/50 hover:text-nx-cyan"
    >{children}</button>
  );
}

function ToggleBtn({ active, onClick, Icon, children, subtle }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors',
        subtle ? '' : 'border',
        active
          ? `bg-nx-cyan/15 text-nx-cyan shadow-glow-soft ${subtle ? '' : 'border-nx-cyan/55'}`
          : `text-nx-mute hover:text-nx-text ${subtle ? 'hover:bg-nx-panel/60' : 'border-nx-line/60 hover:border-nx-cyan/40'}`
      ].join(' ')}
    >
      {Icon && <Icon size={11} aria-hidden="true" />}
      {children}
    </button>
  );
}

function TempLegend() {
  return (
    <div className="pointer-events-none absolute bottom-7 right-2 rounded border border-nx-line/70 bg-nx-bg/75 px-2 py-1.5 backdrop-blur">
      <div className="h-1.5 w-40 rounded-full" style={{ background: 'linear-gradient(90deg,#3b6cff,#22e6ff,#3ddc84,#ffb84a,#ff5c7a)' }} />
      <div className="mt-0.5 flex justify-between font-mono text-[9px] text-nx-mute"><span>14°</span><span>21°</span><span>27°</span></div>
    </div>
  );
}

export default House3DView;
