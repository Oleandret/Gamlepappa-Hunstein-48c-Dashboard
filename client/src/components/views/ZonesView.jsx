import { useMemo, useState } from 'react';
import { ChevronLeft, Home as HomeIcon, Building2 } from 'lucide-react';
import { DeviceCard } from '../DeviceCard.jsx';
import { classLabel } from '../../lib/deviceUtils.js';

export function ZonesView({ devices, zones, onSet, favorites }) {
  const [openZoneId, setOpenZoneId] = useState(null);
  const tree = useMemo(() => buildZoneTree(zones, devices), [zones, devices]);

  if (openZoneId) {
    return (
      <ZoneDetail
        zoneId={openZoneId}
        zones={zones}
        devices={devices}
        tree={tree}
        onBack={() => setOpenZoneId(null)}
        onOpen={setOpenZoneId}
        onSet={onSet}
        favorites={favorites}
      />
    );
  }

  return (
    <div>
      <h2 className="panel-title">Rom · {tree.totalZones} aktive · {tree.totalDevices} enheter</h2>
      <div className="mt-3 space-y-4">
        {tree.floors.map(floor => (
          <FloorSection key={floor.id} floor={floor} onOpen={setOpenZoneId} />
        ))}
      </div>
    </div>
  );
}

function FloorSection({ floor, onOpen }) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-1.5">
        <Building2 size={12} className="text-nx-cyan" aria-hidden="true" />
        <h3 className="panel-title flex-1">{floor.name}</h3>
        <span className="font-mono text-[10px] text-nx-mute">{floor.totalDevices} enh</span>
      </header>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
        {floor.rooms.map(r => (
          <RoomCard key={r.id} room={r} onClick={() => onOpen(r.id)} />
        ))}
      </div>
    </section>
  );
}

function RoomCard({ room, onClick }) {
  const top = room.classCounts.slice(0, 1);
  return (
    <button
      onClick={onClick}
      className="panel p-2 text-left hover:border-nx-cyan/50 transition-colors group"
      aria-label={`Åpne ${room.name} (${room.totalDevices} enheter)`}
    >
      <div className="flex items-center justify-between">
        <HomeIcon size={11} className="text-nx-cyan group-hover:scale-110 transition-transform" aria-hidden="true" />
        <span className="font-mono text-sm text-nx-text tabular-nums">{room.totalDevices}</span>
      </div>
      <div className="mt-1 text-xs font-semibold leading-tight truncate" title={room.name}>{room.name}</div>
      <div className="text-[9px] text-nx-mute font-mono uppercase tracking-[0.12em] truncate">
        {top.map(c => `${c.count} ${classLabel(c.cls).toLowerCase()}`).join(' · ') || '—'}
        {room.onCount > 0 && <span className="text-nx-cyan ml-1">· {room.onCount} på</span>}
      </div>
    </button>
  );
}

function ZoneDetail({ zoneId, zones, devices, tree, onBack, onOpen, onSet, favorites }) {
  const node = findZone(tree, zoneId);
  const zoneName = node?.name || zones?.[zoneId]?.name || 'Ukjent rom';
  const descendantIds = useMemo(() => collectZoneIds(zones, zoneId), [zones, zoneId]);
  const list = useMemo(
    () => Object.values(devices || {}).filter(d => descendantIds.includes(d.zone)),
    [devices, descendantIds]
  );
  const subRooms = useMemo(
    () => Object.values(zones || {}).filter(z => z.parent === zoneId),
    [zones, zoneId]
  );

  return (
    <div>
      <button onClick={onBack} className="btn text-xs" aria-label="Tilbake til alle rom">
        <ChevronLeft size={14} aria-hidden="true" /> ALLE ROM
      </button>
      <h2 className="mt-3 text-xl font-semibold">{zoneName}</h2>
      <p className="text-xs text-nx-mute font-mono mt-1">
        {list.length} enheter
        {subRooms.length > 0 && ` · ${subRooms.length} underrom`}
      </p>

      {subRooms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subRooms.map(r => (
            <button
              key={r.id}
              onClick={() => onOpen(r.id)}
              className="chip text-[11px] hover:border-nx-cyan/60 hover:text-nx-cyan transition-colors"
              aria-label={`Åpne ${r.name}`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(d => (
          <DeviceCard
            key={d.id}
            device={d}
            zoneName={zones?.[d.zone]?.name}
            onSet={onSet}
            isFavorite={favorites?.isFavorite(d.id)}
            onToggleFavorite={favorites?.toggle}
          />
        ))}
        {list.length === 0 && (
          <p className="text-sm text-nx-mute">Ingen enheter i dette rommet.</p>
        )}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildZoneTree(zones, devices) {
  const all = Object.values(zones || {});
  const devList = Object.values(devices || {});

  const directCount = {};
  const onCount = {};
  const classCounts = {};
  for (const d of devList) {
    if (!d.zone) continue;
    directCount[d.zone] = (directCount[d.zone] || 0) + 1;
    if (d.capabilities?.onoff) onCount[d.zone] = (onCount[d.zone] || 0) + 1;
    classCounts[d.zone] = classCounts[d.zone] || {};
    classCounts[d.zone][d.class] = (classCounts[d.zone][d.class] || 0) + 1;
  }

  const map = new Map();
  for (const z of all) {
    map.set(z.id, {
      id: z.id, name: z.name, parent: z.parent,
      directDevices: directCount[z.id] || 0,
      onCount: onCount[z.id] || 0,
      classCounts: Object.entries(classCounts[z.id] || {})
        .map(([cls, count]) => ({ cls, count }))
        .sort((a, b) => b.count - a.count),
      children: [],
      totalDevices: 0
    });
  }
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent).children.push(node);
    }
  }
  const computeTotal = (n) => {
    n.totalDevices = n.directDevices + n.children.reduce((s, c) => s + computeTotal(c), 0);
    return n.totalDevices;
  };
  const roots = [...map.values()].filter(n => !n.parent || !map.has(n.parent));
  for (const r of roots) computeTotal(r);

  // Build "floors" — root + each first-level child becomes a floor section.
  const floors = [];
  for (const root of roots) {
    // Root with direct devices = a floor itself
    if (root.directDevices > 0) {
      floors.push({
        id: root.id,
        name: root.name,
        totalDevices: root.directDevices,
        rooms: [withTotal(root, root.directDevices)]
      });
    }
    for (const child of root.children) {
      const rooms = [];
      if (child.directDevices > 0) rooms.push(withTotal(child, child.directDevices));
      rooms.push(...flattenChildren(child));
      const totalDev = rooms.reduce((s, r) => s + r.totalDevices, 0);
      if (rooms.length > 0) {
        floors.push({ id: child.id, name: child.name, totalDevices: totalDev, rooms });
      }
    }
  }
  floors.sort((a, b) => b.totalDevices - a.totalDevices);
  for (const f of floors) f.rooms.sort((a, b) => b.totalDevices - a.totalDevices);

  return { floors, totalZones: all.length, totalDevices: devList.length };
}

function withTotal(node, total) {
  return { ...node, totalDevices: total };
}

function flattenChildren(node) {
  const out = [];
  for (const c of node.children) {
    if (c.directDevices > 0) out.push(withTotal(c, c.directDevices));
    out.push(...flattenChildren(c));
  }
  return out;
}

function findZone(tree, zoneId) {
  for (const f of tree.floors) {
    for (const r of f.rooms) {
      if (r.id === zoneId) return r;
    }
  }
  return null;
}

function collectZoneIds(zones, rootId) {
  const ids = [rootId];
  const all = Object.values(zones || {});
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    for (const z of all) {
      if (z.parent === current) {
        ids.push(z.id);
        queue.push(z.id);
      }
    }
  }
  return ids;
}
