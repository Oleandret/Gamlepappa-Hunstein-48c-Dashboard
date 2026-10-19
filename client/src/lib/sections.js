import { Network, Thermometer, Home, LayoutGrid, Boxes, Workflow, Zap, ShieldCheck, Star, Settings, Music, Map, Bot, Anchor, Wrench, Bookmark, Activity, Sparkles, MessageSquare, Box, HeartHandshake } from 'lucide-react';

/** Single source of truth for top-level navigation. */
export const SECTIONS = [
  {id:'huspuls',label:'Huspuls',Icon:Activity},
  { id: 'oversikt',          label: 'Oversikt',        Icon: Home },
  { id: 'rom',               label: 'Rom',             Icon: LayoutGrid },
  { id: 'plantegning-hus',   label: 'Plan hus',        Icon: Map },
  { id: 'hus-3d',            label: '3D-hus',          Icon: Box },
  { id: 'plantegning-hytte', label: 'Plan hytte',      Icon: Anchor },
  { id: 'enheter',           label: 'Enheter',         Icon: Boxes },
  { id: 'lyd',               label: 'Lyd',             Icon: Music },
  { id: 'automasjon',        label: 'Automasjon',      Icon: Workflow },
  { id: 'flow-favoritter',   label: 'Flow-favoritter', Icon: Star },
  { id: 'varmestyring', label: 'Varmestyring', Icon: Thermometer },
  { id: 'stromsparing', label: 'Strømsparing', Icon: Zap },
  { id: 'energi',            label: 'Energi',          Icon: Zap },
  { id: 'historikk', label: 'Historikk', Icon: Activity },
  { id: 'nettverk', label: 'Nettverk', Icon: Network },
  { id: 'sikkerhet',         label: 'Sikkerhet',       Icon: ShieldCheck },
  { id: 'avatar',            label: 'Avatar',          Icon: Bot },
  { id: 'chat',              label: 'AI-chat',         Icon: MessageSquare },
  { id: 'favoritter',        label: 'Favoritter',      Icon: Star },
  { id: 'lenker',            label: 'Lenker',          Icon: Bookmark },
  { id: 'huset',             label: 'Huset',           Icon: HeartHandshake },
  { id: 'vedlikehold',       label: 'Vedlikehold',     Icon: Wrench },
  { id: 'innsikt',           label: 'Innsikt',         Icon: Activity },
  { id: 'ai-flows',          label: 'AI-flows',        Icon: Sparkles },
  { id: 'innstillinger',     label: 'Innstillinger',   Icon: Settings }
];
