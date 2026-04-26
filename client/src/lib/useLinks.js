import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nexora.links.v1';

/**
 * Brukerens samling av favoritt-nettsider, kategoriserte.
 * Hver lenke: { id, url, title, category }
 *
 * Default-listen seedes første gang og kan justeres fritt etterpå.
 */
const DEFAULT_LINKS = [
  // Smarthus
  { url: 'https://my.homey.app/homeys/64f5c8926da3f17a12bc9c7c', title: 'Homey',         category: 'Smarthus' },

  // Verktøy / automasjon
  { url: 'https://oleandre.app.n8n.cloud/',                     title: 'n8n',           category: 'Verktøy' },
  { url: 'https://railway.com/',                                title: 'Railway',       category: 'Verktøy' },
  { url: 'https://www.google.com/',                             title: 'Google',        category: 'Verktøy' },
  { url: 'https://m365.cloud.microsoft/',                       title: 'Microsoft 365', category: 'Verktøy' },

  // Nyheter
  { url: 'https://www.vg.no/',                                  title: 'VG',            category: 'Nyheter' },
  { url: 'https://www.dagbladet.no/',                           title: 'Dagbladet',     category: 'Nyheter' },
  { url: 'https://e24.no/',                                     title: 'E24',           category: 'Nyheter' },
  { url: 'https://www.tek.no/',                                 title: 'Tek.no',        category: 'Teknologi' },

  // Finans
  { url: 'https://bitcoinity.org/markets/bitfinex/USD',         title: 'Bitcoinity',    category: 'Finans' },

  // Marked
  { url: 'https://www.finn.no/',                                title: 'Finn',          category: 'Marked' },

  // Underholdning
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

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return withIds(DEFAULT_LINKS);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return withIds(DEFAULT_LINKS);
    return parsed
      .filter(l => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
      .map(l => ({
        id: typeof l.id === 'string' ? l.id : newId(),
        url: l.url,
        title: typeof l.title === 'string' && l.title ? l.title : l.url,
        category: typeof l.category === 'string' && l.category ? l.category : 'Annet'
      }));
  } catch {
    return withIds(DEFAULT_LINKS);
  }
}

function write(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
  catch {}
}

export function useLinks() {
  const [list, setList] = useState(read);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setList(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((link) => {
    if (!link?.url || !/^https?:\/\//i.test(link.url)) return;
    setList(prev => {
      const next = [...prev, {
        id: newId(),
        url: link.url,
        title: link.title || link.url,
        category: link.category || 'Annet'
      }];
      write(next);
      return next;
    });
  }, []);

  const update = useCallback((id, patch) => {
    setList(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...patch } : l);
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setList(prev => {
      const next = prev.filter(l => l.id !== id);
      write(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const seed = withIds(DEFAULT_LINKS);
    setList(seed);
    write(seed);
  }, []);

  return { list, add, update, remove, resetToDefaults };
}
