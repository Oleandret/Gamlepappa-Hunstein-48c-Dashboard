import { useCallback } from 'react';
import { useServerSyncedState } from './useServerSyncedState.js';

const DEFAULT_LINKS = [
  { url: 'https://my.homey.app/homeys/64f5c8926da3f17a12bc9c7c', title: 'Homey',         category: 'Smarthus' },
  { url: 'https://oleandre.app.n8n.cloud/',                     title: 'n8n',           category: 'Verktøy' },
  { url: 'https://railway.com/',                                title: 'Railway',       category: 'Verktøy' },
  { url: 'https://www.google.com/',                             title: 'Google',        category: 'Verktøy' },
  { url: 'https://m365.cloud.microsoft/',                       title: 'Microsoft 365', category: 'Verktøy' },
  { url: 'https://www.vg.no/',                                  title: 'VG',            category: 'Nyheter' },
  { url: 'https://www.dagbladet.no/',                           title: 'Dagbladet',     category: 'Nyheter' },
  { url: 'https://e24.no/',                                     title: 'E24',           category: 'Nyheter' },
  { url: 'https://www.tek.no/',                                 title: 'Tek.no',        category: 'Teknologi' },
  { url: 'https://bitcoinity.org/markets/bitfinex/USD',         title: 'Bitcoinity',    category: 'Finans' },
  { url: 'https://www.finn.no/',                                title: 'Finn',          category: 'Marked' },
  { url: 'https://www.youtube.com/',                            title: 'YouTube',       category: 'Underholdning' }
];

function newId() {
  return `lnk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function withIds(links) {
  return links.map((l, i) => ({
    id: l.id || `lnk-default-${i}`,
    url: l.url,
    title: l.title || l.url,
    category: l.category || 'Annet'
  }));
}

function sanitize(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return withIds(DEFAULT_LINKS);
  return arr
    .filter(l => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
    .map(l => ({
      id: typeof l.id === 'string' ? l.id : newId(),
      url: l.url,
      title: typeof l.title === 'string' && l.title ? l.title : l.url,
      category: typeof l.category === 'string' && l.category ? l.category : 'Annet'
    }));
}

export function useLinks() {
  const [list, setList, sync] = useServerSyncedState('links', () => withIds(DEFAULT_LINKS));
  const cleanList = sanitize(list);

  const add = useCallback((link) => {
    if (!link?.url || !/^https?:\/\//i.test(link.url)) return;
    setList(prev => [
      ...(Array.isArray(prev) ? prev : []),
      { id: newId(), url: link.url, title: link.title || link.url, category: link.category || 'Annet' }
    ]);
  }, [setList]);

  const update = useCallback((id, patch) => {
    setList(prev => (Array.isArray(prev) ? prev : []).map(l => l.id === id ? { ...l, ...patch } : l));
  }, [setList]);

  const remove = useCallback((id) => {
    setList(prev => (Array.isArray(prev) ? prev : []).filter(l => l.id !== id));
  }, [setList]);

  const resetToDefaults = useCallback(() => setList(withIds(DEFAULT_LINKS)), [setList]);

  return { list: cleanList, add, update, remove, resetToDefaults, sync };
}
