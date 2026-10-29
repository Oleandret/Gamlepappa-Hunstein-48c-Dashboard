// Ren logikk uten nettleseravhengigheter, delt mellom Mac-panelet og tester.

/** Peker-bevegelse → klikk, dobbeltklikk (clicks ≥ 2), klikk med modifikatorer eller dra. */
export function macPointerAction(from, to, heldSeconds, clicks = 1, modifiers = []) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist > 6) return ['/api/mac/drag', { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, duration: Math.min(2, Math.max(0.2, heldSeconds)) }];
  const body = { x: from.x, y: from.y };
  if (clicks >= 2) body.count = 2;
  if (modifiers.length) body.modifiers = modifiers;
  return ['/api/mac/click', body];
}

const KEY_NAMES = { Enter: 'return', Tab: 'tab', Backspace: 'delete', Delete: 'forwarddelete', Escape: 'escape', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end', PageUp: 'pageup', PageDown: 'pagedown', ' ': 'space' };
const MODIFIER_KEYS = new Set(['Shift', 'Meta', 'Alt', 'Control', 'CapsLock']);

/** Modifikatorer i et tastaturhendelse-objekt, i mac-agent sin rekkefølge. */
export const eventModifiers = ev => [ev.metaKey && 'cmd', ev.shiftKey && 'shift', ev.altKey && 'alt', ev.ctrlKey && 'ctrl'].filter(Boolean);

/** Tastetrykk i nettleseren → tekst (vanlige tegn) eller snarvei (alt annet). null = ignorer. */
export function keyEventAction(ev) {
  if (MODIFIER_KEYS.has(ev.key)) return null;
  const mods = eventModifiers(ev);
  let name = KEY_NAMES[ev.key] || (/^F\d{1,2}$/.test(ev.key) ? ev.key.toLowerCase() : null);
  if (!name && ev.key.length === 1) {
    if (!mods.length || (mods.length === 1 && mods[0] === 'shift')) return ['/api/mac/type', { text: ev.key }];
    name = ev.key.toLowerCase();
  }
  if (!name) return null;
  return ['/api/mac/key', { combo: [...mods, name].join('+') }];
}
