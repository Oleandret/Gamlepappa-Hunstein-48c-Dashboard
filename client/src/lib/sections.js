import { Home, LayoutGrid, Boxes, Workflow, Zap, ShieldCheck, Star, Settings, Music, Map, Bot, Anchor, Wrench, Bookmark } from 'lucide-react';

/** Single source of truth for top-level navigation. */
export const SECTIONS = [
  { id: 'oversikt',          label: 'Oversikt',        Icon: Home },
  { id: 'rom',               label: 'Rom',             Icon: LayoutGrid },
  { id: 'plantegning-hus',   label: 'Plan hus',        Icon: Map },
  { id: 'plantegning-hytte', label: 'Plan hytte',      Icon: Anchor },
  { id: 'enheter',           label: 'Enheter',         Icon: Boxes },
  { id: 'lyd',               label: 'Lyd',             Icon: Music },
  { id: 'automasjon',        label: 'Automasjon',      Icon: Workflow },
  { id: 'flow-favoritter',   label: 'Flow-favoritter', Icon: Star },
  { id: 'energi',            label: 'Energi',          Icon: Zap },
  { id: 'sikkerhet',         label: 'Sikkerhet',       Icon: ShieldCheck },
  { id: 'avatar',            label: 'Avatar',          Icon: Bot },
  { id: 'favoritter',        label: 'Favoritter',      Icon: Star },
  { id: 'lenker',            label: 'Lenker',          Icon: Bookmark },
  { id: 'vedlikehold',       label: 'Vedlikehold',     Icon: Wrench },
  { id: 'innstillinger',     label: 'Innstillinger',   Icon: Settings }
];
