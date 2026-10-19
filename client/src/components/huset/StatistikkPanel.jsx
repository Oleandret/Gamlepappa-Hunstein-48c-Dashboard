import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { osloDate, addDays, dayLabel } from './shared.js';

// Farger validert for mørk flate (#141e2b), også for fargeblinde: oransje = åpen, blå = løst/antall.
const OPEN = '#d95926', DONE = '#3987e5', SURFACE = '#141e2b';
const axis = { tickLine: false, axisLine: false, tick: { fill: '#9eb2c8', fontSize: 11 } };
const tooltip = { contentStyle: { background: '#172536', border: '1px solid #40546c', borderRadius: 12, color: '#e6eef7', fontSize: 12 }, cursor: { fill: 'rgba(124,226,196,0.08)' } };
const monday = date => { const d = new Date(`${date}T00:00:00Z`); return addDays(date, -((d.getUTCDay() + 6) % 7)); };

function Tile({ label, value, note, warn }) {
  return <div className="panel p-4"><p className="text-xs text-nx-mute">{label}</p><p className={`text-3xl font-semibold mt-1 ${warn ? 'text-nx-amber' : ''}`}>{value}</p>{note && <p className="text-xs text-nx-mute mt-1">{note}</p>}</div>;
}

function ChartCard({ title, children, rows, columns, legend, height = 220 }) {
  return <section className="panel p-4 min-w-0">
    <h3 className="text-sm font-semibold">{title}</h3>
    {legend && <div className="flex gap-4 mt-2 text-xs text-nx-mute">{legend.map(([name, color]) => <span key={name} className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} aria-hidden="true" />{name}</span>)}</div>}
    <div style={{ height }} className="mt-3">{children}</div>
    <details className="mt-2 text-xs text-nx-mute"><summary className="cursor-pointer">Vis som tabell</summary>
      <table className="mt-2 w-full text-left"><thead><tr>{columns.map(c => <th key={c} className="py-1 pr-2 font-normal">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-nx-line/40">{r.map((v, j) => <td key={j} className="py-1 pr-2 text-nx-text">{v}</td>)}</tr>)}</tbody></table>
    </details>
  </section>;
}

export function StatistikkPanel({ h }) {
  const s = useMemo(() => {
    const today = h.today, since30 = addDays(today, -30);
    const open = h.avvik.filter(a => a.status === 'apen');
    const resolved30 = h.avvik.filter(a => a.lost && osloDate(a.lost) > since30);
    const active = h.tasks.filter(t => t.status === 'aktiv');
    const overdue = active.filter(t => t.frist < today);
    const done = h.tasks.flatMap(t => (t.fullfort || []).map(f => ({ ...f, ansvarlig: t.ansvarlig })));
    const done30 = done.filter(f => f.dato > since30);
    const thisWeek = monday(today);
    const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, (i - 11) * 7)).map(w => ({ uke: w, label: dayLabel(w), antall: h.avvik.filter(a => monday(osloDate(a.opprettet)) === w).length }));
    const people = h.residents.map(name => ({ name, apen: open.filter(a => a.person === name).length, lost: h.avvik.filter(a => a.person === name && a.status === 'lost').length, gjort: done30.filter(f => f.av === name).length, sine: done30.filter(f => f.ansvarlig === name).length }));
    const categories = h.categories.map(c => ({ name: c, antall: h.avvik.filter(a => a.kategori === c).length })).filter(c => c.antall).sort((a, b) => b.antall - a.antall);
    return { open, resolved30, active, overdue, done30, weeks, people, categories, proposals: h.rules.filter(r => r.status === 'forslag').length, rules: h.rules.filter(r => r.status === 'gjeldende').length };
  }, [h.avvik, h.tasks, h.rules, h.residents, h.categories, h.today]);

  const empty = !h.avvik.length && !h.tasks.length;
  const personHeight = Math.max(180, h.residents.length * 30 + 30);
  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Åpne avvik" value={s.open.length} note={`${s.resolved30.length} løst siste 30 dager`} />
        <Tile label="Aktive gjøremål" value={s.active.length} note={`${s.done30.length} gjort siste 30 dager`} />
        <Tile label="Forfalte gjøremål" value={s.overdue.length} warn={s.overdue.length > 0} note={s.overdue.length ? 'Se Gjøremål' : 'Alt i rute'} />
        <Tile label="Husregler" value={s.rules} note={s.proposals ? `${s.proposals} forslag venter` : 'Ingen forslag venter'} />
        <Tile label="Avvik totalt" value={h.avvik.length} note={`${s.categories.length} kategorier`} />
      </div>
      {empty ? <p className="panel p-5 text-sm text-nx-mute">Grafene fylles opp når dere har registrert avvik og gjøremål.</p> :
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <ChartCard title="Nye avvik per uke (siste 12 uker)" columns={['Uke fra', 'Avvik']} rows={s.weeks.map(w => [w.label, w.antall])}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.weeks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2b3b4d" strokeDasharray="3 5" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip {...tooltip} formatter={v => [v, 'Avvik']} labelFormatter={l => `Uke fra ${l}`} />
            <Bar dataKey="antall" fill={DONE} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Avvik per beboer" legend={[['Åpne', OPEN], ['Løst', DONE]]} columns={['Beboer', 'Åpne', 'Løst']} rows={s.people.map(p => [p.name, p.apen, p.lost])} height={personHeight}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.people} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#2b3b4d" strokeDasharray="3 5" />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="name" width={72} {...axis} />
            <Tooltip {...tooltip} />
            <Bar dataKey="apen" name="Åpne" stackId="a" fill={OPEN} stroke={SURFACE} strokeWidth={1} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="lost" name="Løst" stackId="a" fill={DONE} stroke={SURFACE} strokeWidth={1} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Avvik per kategori" columns={['Kategori', 'Avvik']} rows={s.categories.map(c => [c.name, c.antall])} height={Math.max(160, s.categories.length * 30 + 30)}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.categories} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#2b3b4d" strokeDasharray="3 5" />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="name" width={104} {...axis} />
            <Tooltip {...tooltip} formatter={v => [v, 'Avvik']} />
            <Bar dataKey="antall" fill={DONE} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Gjøremål gjort siste 30 dager" columns={['Beboer', 'Gjort']} rows={s.people.map(p => [p.name, p.gjort])} height={personHeight}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.people} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#2b3b4d" strokeDasharray="3 5" />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="name" width={72} {...axis} />
            <Tooltip {...tooltip} formatter={v => [v, 'Gjort']} />
            <Bar dataKey="gjort" fill={DONE} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
      </div>}
    </div>
  );
}
