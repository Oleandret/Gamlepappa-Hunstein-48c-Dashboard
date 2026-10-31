// Skjermdeling (VNC) i nettleseren: ren logikk uten nettleseravhengigheter, delt med tester.

/** WebSocket-adressen til VNC-broen for en Mac, via dashboardets /iphone-mellomtjener (billetten følger som cookie). */
export function vncSocketUrl(macId, { protocol, host }) {
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/iphone/api/mac/vnc?mac=${encodeURIComponent(macId)}`;
}

/** X11-keysym for ett tegn, slik RFB vil ha det: Latin-1 direkte, resten som Unicode-keysym (0x01000000 | kodepunkt). */
export function keysymForChar(ch) {
  const code = ch.codePointAt(0);
  if (code === 0x0a || code === 0x0d) return XK.Return;
  if (code === 0x09) return XK.Tab;
  return code < 0x100 ? code : 0x01000000 | code;
}

/** Spesialtaster (X11-keysymer) for tasteraden og for tastetrykk fra det skjulte feltet. */
export const XK = {
  BackSpace: 0xff08, Tab: 0xff09, Return: 0xff0d, Escape: 0xff1b, Delete: 0xffff,
  Left: 0xff51, Up: 0xff52, Right: 0xff53, Down: 0xff54,
  Shift_L: 0xffe1, Control_L: 0xffe3, Alt_L: 0xffe9, Super_L: 0xffeb
};

/** KeyboardEvent.key → keysym for tastene det skjulte feltet ikke gir som tekst; null for vanlig tekst. */
export function keysymForKey(key) {
  return { Backspace: XK.BackSpace, Enter: XK.Return, Tab: XK.Tab, Escape: XK.Escape, Delete: XK.Delete,
    ArrowLeft: XK.Left, ArrowUp: XK.Up, ArrowRight: XK.Right, ArrowDown: XK.Down }[key] ?? null;
}

/** Tasteraden over skjermen: [visningsnavn, keysym, «klebrig» (holdes til neste tast)]. */
export const KEY_BAR = [['esc', XK.Escape], ['tab', XK.Tab], ['⌘', XK.Super_L, true], ['⌃', XK.Control_L, true], ['⌥', XK.Alt_L, true], ['⏎', XK.Return], ['⌫', XK.BackSpace], ['←', XK.Left], ['→', XK.Right], ['↑', XK.Up], ['↓', XK.Down]];

export const VNC_USER_KEY = macId => `nexora.vnc.user.${macId}`;

/** Lesbar status for forbindelsen. */
export function vncStatusText(status, detail = '') {
  return { idle: '', connecting: 'Kobler til …', credentials: 'Logg inn på Macen', connected: 'Tilkoblet', closed: 'Frakoblet',
    error: detail || 'Fikk ikke kontakt med Skjermdeling på Macen' }[status] ?? '';
}
