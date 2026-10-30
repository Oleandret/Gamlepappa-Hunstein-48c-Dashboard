// Visningsmodus for iPhone-skjermen (telefonpanelet og Iphone-fanen): ren logikk uten nettleseravhengigheter, delt med tester.

/**
 * Modusene en kan velge: «Normal» (skjerm med knapper og tastatur), «Stor» (bare skjermen, så høy
 * som vinduet – panelet vokser mot venstre) og «Fullskjerm» (nettleserens fullskjerm; på iPhone
 * legges skjermen over hele vinduet i stedet). Bare normal/stor huskes: fullskjerm må nettleseren
 * få bedt om ved et klikk hver gang.
 */
export const PHONE_VIEWS = [['normal', 'Normal'], ['stor', 'Stor'], ['full', 'Fullskjerm']];
export const PHONE_VIEW_KEY = 'nexora.iphone.view';
export const validPhoneView = v => (v === 'stor' ? 'stor' : 'normal');

/**
 * Panelbredde i «Stor» på bred skjerm: telefonen fyller hele vindushøyden, så panelet må være så
 * bredt som telefonen blir (høyde × sideforhold) pluss sidekanter. `chrome` er det som går bort i
 * topptekst, luft og kanter. Aldri smalere enn vanlig panel, og aldri så bredt at resten av siden forsvinner.
 */
export function storPanelWidth({ innerWidth, innerHeight, chrome, size, padding = 26, min = 340, keep = 240 }) {
  const h = Math.max(0, innerHeight - chrome);
  const w = Math.ceil(h * size.width / size.height) + padding;
  return Math.max(min, Math.min(w, Math.max(min, innerWidth - keep)));
}
