// Ren logikk uten nettleseravhengigheter, delt mellom telefonpanelet og tester.
/** Peker-bevegelse → trykk, langt trykk eller sveip (samme terskler som iphone-remote). */
export function pointerAction(from, to, heldSeconds) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist > 12) return ['/api/swipe', { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, duration: Math.min(1, Math.max(0.1, heldSeconds)) }];
  if (heldSeconds > 0.6) return ['/api/longpress', { x: from.x, y: from.y, duration: Math.min(3, heldSeconds) }];
  return ['/api/tap', { x: from.x, y: from.y }];
}
