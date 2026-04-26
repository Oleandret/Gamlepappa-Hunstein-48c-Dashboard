import { Home, LayoutGrid, Boxes, Workflow, Zap, ShieldCheck, Star, Settings } from 'lucide-react';

/** Single source of truth for top-level navigation. */
export const SECTIONS = [
  { id: 'oversikt',      label: 'Oversikt',     Icon: Home },
  { id: 'rom',           label: 'Rom',          Icon: LayoutGrid },
  { id: 'enheter',       label: 'Enheter',      Icon: Boxes },
  { id: 'automasjon',    label: 'Automasjon',   Icon: Workflow },
  { id: 'energi',        label: 'Energi',       Icon: Zap },
  { id: 'sikkerhet',     label: 'Sikkerhet',    Icon: ShieldCheck },
  { id: 'favoritter',    label: 'Favoritter',   Icon: Star },
  { id: 'innstillinger', label: 'Innstillinger', Icon: Settings }
];
