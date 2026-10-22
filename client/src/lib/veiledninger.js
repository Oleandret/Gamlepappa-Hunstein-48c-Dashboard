/**
 * Veiledninger for Hunstein 48c: hvordan huset brukes og holdes ved like.
 * Skrevet med egne ord ut fra FDV-dokumentasjonen (mappen «FDV») og
 * romskjemaet 08.10.2018. Kildene står på hver veiledning.
 *
 * Veiledning: { id, title, kategori, icon, model?, intro, blocks: [{ title, tone?, items }], tables?, kilder }
 */

const SJEKK = '(sjekk)';

export const GUIDES = [
  // ── Varme ──
  {
    id: 'varmepumpe', title: 'Varmepumpe og oppvarming', kategori: 'Varme', icon: 'Flame',
    model: 'NIBE F1255-12 bergvarmepumpe · energibrønn 193 m',
    intro: 'Henter varme fra energibrønnen og varmer huset (250 m²), varmtvannet i den innebygde beredren (180 l) og bassenget.',
    blocks: [
      { title: 'Slik bruker du det', items: [
        'Varmen styres etter utetemperaturen med en varmekurve. Er det for kaldt eller varmt inne, juster kurven (helning eller forskyvning) i menyen.',
        'Anlegget er beregnet for 21 °C inne. Oppvarmingen stopper når det er 13 °C eller varmere ute.',
        'Trenger du mye varmtvann, slå på midlertidig ekstra varmtvann. Det kan stå på i 3–12 timer.',
        'Mens varmtvannet varmes, lager ikke pumpen varme til rommene. Det er normalt.',
        'Varmtvannet varmes ekstra opp automatisk hver 14. dag mot bakterier. Ikke slå av denne funksjonen.',
        `Bassengvarmen styres fra varmepumpen med en bassengføler ${SJEKK}.`
      ] },
      { title: 'Fast vedlikehold', items: [
        `Se jevnlig til nivåkaret for kollektorvæsken. Intervall står ikke i FDV ${SJEKK}.`,
        'Partikkelfilteret på varmesiden og årlig ettersyn tas av rørlegger.',
        'Brukerhåndboken med menyer og alarmkoder mangler i FDV-mappa og bør skaffes.'
      ] },
      { title: 'Hvis noe er galt', tone: 'alert', items: [
        'Alarm i displayet: noter teksten og kontakt ABK/NIBE-forhandleren.',
        'Kaldt i ett rom: sjekk at romføleren ikke står i sol, bak en gardin eller nær en varmekilde, og at termostatene ikke er skrudd ned. Juster deretter varmekurven.',
        'Lite varmtvann: slå på ekstra varmtvann. Hjelper ikke det, ring service.',
        'Uventet høyt strømforbruk: pumpen skal dekke alt uten elkolbe. Bruker den mye strøm, bør rørlegger se på anlegget.'
      ] }
    ],
    kilder: ['Produktark NIBE F1255 s. 1–2', 'NIBE systemskjema M10789 s. 1–6', 'Energiberegning 2018 s. 1']
  },
  {
    id: 'vannbaaren', title: 'Varmeanlegg og tappevann', kategori: 'Varme', icon: 'Droplets',
    model: 'MagnaClean Professional2 · ABK Buffer 200 · Aquapresso ADF 18 L · ESBE VMB423',
    intro: 'Disse delene holder varmevannet rent, jevnt og under riktig trykk. De går automatisk, så normalt skal du ikke stille på noe.',
    blocks: [
      { title: 'Hva er hva', items: [
        'MagnaClean er et magnetfilter på returrøret. Det fanger slam og magnetiske partikler.',
        'ABK Buffer 200 er utjevningstanken i varmeanlegget. Den har luftenippel på toppen.',
        'Aquapresso 18 L er ekspansjonskaret for tappevannet (fortrykk 4 bar fra fabrikk). Varmekretsen har eget ekspansjonskar og sikkerhetsventil.',
        `ESBE-ventilen er trolig blandeventilen for varmtvannet ${SJEKK}. Ikke skru den opp uten grunn, da kan vannet bli skoldende varmt.`
      ] },
      { title: 'Fast vedlikehold', items: [
        `Les av trykkmåleren på varmeanlegget jevnlig. Riktig trykk står ikke i FDV ${SJEKK} med rørlegger.`,
        `Magnetfilteret rengjøres av fagperson, og anlegget doseres med inhibitor etterpå. Intervall står ikke i FDV ${SJEKK}.`
      ] },
      { title: 'Hvis noe er galt', tone: 'alert', items: [
        'Lunkne gulv eller radiatorer, eller suselyd i rørene: kan skyldes luft eller tett filter. Ring rørlegger.',
        'Trykket faller gang på gang, eller sikkerhetsventilen drypper: ring rørlegger.',
        'Vann på gulvet ved tank eller kar: steng vannet hvis du vet hvor stengeventilen er, og ring rørlegger.'
      ] }
    ],
    kilder: ['MagnaClean Prof2 FDV s. 1–2', 'ABK tank s. 1', 'Produktark ekspansjonskar', 'Produktark blandeventil', 'NIBE systemskjema s. 1, 4']
  },
  {
    id: 'energimaaler', title: 'Energimåler for varmepumpen', kategori: 'Varme', icon: 'Gauge',
    model: 'ABK energimålerskap (art. 523368)',
    intro: 'Låsbart skap som måler strømmen varmepumpen bruker, og som beskytter den mot feil på strømnettet.',
    blocks: [
      { title: 'Slik bruker du det', items: [
        'Displayet viser forbruket nå og samlet forbruk i kWh. Les av en gang i måneden eller i året.',
        'Beregningen anslår om lag 12 700 kWh i året til varmepumpen og en årsvarmefaktor på 3,5.',
        'Hovedbryteren i skapet skal bare brukes ved service. Hold skapet låst.'
      ] },
      { title: 'Hvis noe er galt', tone: 'alert', items: [
        'Varmepumpen stopper etter strømbrudd: vernet i skapet slår seg automatisk på igjen når spenningen er stabil. Vent litt.',
        'Varmepumpen kommer ikke tilbake: sjekk at bryteren i skapet står på, og ring elektriker.',
        'Forbruket er klart høyere enn ventet: få rørlegger til å se på varmepumpen.'
      ] }
    ],
    kilder: ['ABK energimålerskap produktark s. 1', 'Energiberegning 2018 s. 1']
  },

  // ── Ventilasjon ──
  {
    id: 'ventilasjon', title: 'Ventilasjon', kategori: 'Ventilasjon', icon: 'Wind',
    model: 'Systemair SAVE VTR 500 · roterende varmegjenvinner',
    intro: 'Gir frisk luft i hele huset og gjenvinner varmen fra lufta som går ut. Aggregatet skal alltid gå.',
    blocks: [
      { title: 'Slik bruker du det', items: [
        'Ikonet øverst på startskjermen viser modus. Trykk på det for å bytte. AUTO følger ukeplanen; MANUELL gir Lav, Normal eller Høy. Ikke velg Av.',
        'Viftetrinn: trykk på vifteikonet (bare i MANUELL).',
        'Temperatur på tilluften: trykk på termometeret. Standard er 18 °C, og du kan velge mellom 12 og 30 °C. Øko-modus sparer strøm.',
        'Reiser du bort: velg BORTE (timer) eller FERIE (dager) for lav luftmengde.',
        'Mer luft en stund: BOOST (minutter) eller PARTY (timer). PEIS gir overtrykk så pipa trekker bedre.',
        'Ikke koble tørketrommel til ventilasjonen.'
      ] },
      { title: 'Fast vedlikehold', items: [
        'Bytt filtrene når filteralarmen kommer, normalt hver 12. måned: tilluft F7 (varenr. 208283) og avtrekk G3 (varenr. 208284). Bekreft alarmen etterpå, så starter telleren på nytt.',
        'Slå av strømmen før du åpner luken på aggregatet.',
        'Tørk av ventilene i rommene ved behov.',
        'Vifter og varmegjenvinner rengjøres av fagperson ved behov.'
      ] },
      { title: 'Hvis noe er galt', tone: 'alert', items: [
        'Alarmen «Filter»: bytt filtrene og bekreft alarmen. En alarm kan ikke bekreftes så lenge årsaken er der.',
        'Lite luft: sjekk om BORTE, FERIE eller ukeplanen er på, og se på filtre og ventiler. I kulde kan avriming senke farten en stund, og det er normalt.',
        'Kald tilluft: sjekk Øko, Ferie og Borte. Overopphetingsvernet (rød knapp bak sideluken) kan ha løst ut. Slå av strømmen før du åpner.',
        'Alarmen «Rotorvakt»: drivreima på gjenvinneren kan være røket. Ring service.',
        'Andre alarmer: trykk HJELP i displayet, og ring service hvis det ikke løser seg.',
        'Panelet svarer ikke: trekk ut støpselet i 10 sekunder.'
      ] }
    ],
    kilder: ['VTR 500 montasje og service s. 16–25, 37–42, 57']
  },

  // ── Basseng ──
  {
    id: 'basseng', title: 'Bassenget i hverdagen og vannkvalitet', kategori: 'Basseng', icon: 'Waves',
    model: 'Innendørs basseng 51 m³ · Pahlén',
    intro: 'Det viktigste er at trekket ligger på, at pumpa går hele døgnet og at pH og klor måles hver uke.',
    blocks: [
      { title: 'Hver dag', items: [
        'Ha trekket på når bassenget ikke brukes, særlig om natten. Opptil ca. 70 % av varmen forsvinner gjennom vannflaten.',
        'Pumpa skal gå døgnet rundt.',
        'Vannet skal stå midt i åpningen på skimmeren.',
        'Tilsett kjemikalier om kvelden, etter dagens siste bad.'
      ] },
      { title: 'Måle og justere', items: [
        'Mål med DPD-testsett: tablett nr. 1 gir fritt klor, nr. 3 totalt klor, og fenolrødt gir pH. Ikke ta på tablettene. Teststrimler frarådes.',
        'Over ca. 6 mg/l blekes prøven, så den ser klorfri ut. Bland da prøven 50/50 med springvann og gang svaret med 2.',
        'pH-minus senker og pH-plus hever pH. Én liten dose flytter pH ca. 0,1. Løs opp i en bøtte vann, hell langs kanten eller i skimmeren, og mål igjen etter ca. 12 timer.',
        'Sjokklorer hver 2.–4. uke. Ha vann i bøtta først og granulat etterpå. Senk pH etterpå, fordi sjokkklor hever pH.',
        'Lav alkalitet (TA): litt natriumbikarbonat hver fjerde dag. Høy TA: pH-minus i små porsjoner over flere uker.'
      ] },
      { title: 'Aldri', tone: 'alert', items: [
        'Bland aldri kjemikalier, heller ikke ulike typer klor.',
        'Hell ikke kjemikalier nær metalldeler.',
        'Bruk aldri brom sammen med UV-anlegget.'
      ] },
      { title: 'Hvis vannet ser feil ut', tone: 'alert', items: [
        'Røde øyne eller sterk klorlukt: sjekk pH. Er bundet klor høyt, bytt ut litt vann og sjokklorer.',
        'Grønt vann eller glatte flater: for lite klor. Juster pH, børst og sjokklorer.',
        'Grumsete vann: tilbakespyl filteret og senk pH. Bruk eventuelt flokkuleringsmiddel og tilbakespyl etter ett døgn.',
        'Kalkbelegg: kalsium eller TA er for høyt. Juster vannbalansen.',
        'Bleket hår eller badetøy: for mye klor. Vent noen dager.',
        'Problemer som ikke går over: kontakt bassengleverandøren.'
      ] }
    ],
    tables: [
      {
        title: 'Målområder',
        columns: ['Verdi', 'Pahlén', 'Dantherm (garanti)', 'Hvor ofte'],
        rows: [
          ['pH', '7,2–7,6', '7,2–7,6', 'Hver uke'],
          ['Fritt klor', '0,5–1,6 mg/l', '1,0–2,0 mg/l', 'Hver uke'],
          ['Bundet klor', '0–0,4 mg/l', 'Maks ⅓ av fritt klor', 'Ved behov'],
          ['Alkalitet (TA)', '60–120 mg/l', '80–150 mg/l', 'Hver måned'],
          ['Kalsiumhardhet', '100–300 mg/l', `250–450 mg/l ${SJEKK}`, 'Hver måned']
        ]
      },
      {
        title: 'Vedlikeholdsplan',
        columns: ['Når', 'Hva', 'Hvem'],
        rows: [
          ['Hver uke', 'Mål pH og fritt klor, tøm silkurven i skimmeren, sjekk at UV-lampa lyser', 'Beboer'],
          ['Hver 5.–10. dag', 'Tilbakespyl filteret (eller når manometeret har steget 0,2 bar) og tøm pumpas silkurv', 'Beboer'],
          ['Hver 2.–4. uke', 'Sjokklorer', 'Beboer'],
          ['Hver måned', 'Mål TA og kalsium; rengjør filter, dryppskål og avløp på avfukteren', 'Beboer'],
          ['Ca. hver 1000. time', 'Rengjør kvartsglasset i UV-anlegget', 'Kyndig beboer'],
          ['Hvert år', 'Ettersyn av avfukteren; bytt UV-lampe (9000 timer)', 'Fagperson'],
          ['Hvert 6.–8. år', 'Bytt sanden i filteret', 'Fagperson']
        ]
      }
    ],
    kilder: ['Poolguiden 2019 s. 10–29', 'Pahlén P-01 s. 3', 'MA60-19 s. 3', 'Dantherm servicemanual s. 41']
  },
  {
    id: 'basseng-filter', title: 'Filter og bassengpumpe', kategori: 'Basseng', icon: 'Waves',
    model: 'Pahlén sandfilter · Pahlén P01-pumpe med silkurv',
    intro: 'Sandfilteret renser vannet og må tilbakespyles hver 5.–10. dag, eller når trykket har steget ca. 0,2 bar.',
    blocks: [
      { title: 'Tilbakespyling trinn for trinn', items: [
        '1. Stopp pumpa og steng ventilene på sug- og returledningen. Stopp alltid pumpa før du vrir på filterventilen.',
        '2. Åpne pumpelokket, tøm silkurven og sett lokket på igjen.',
        '3. Åpne ventilen til avløpet og vri håndtaket til BACKSPOLNING.',
        '4. Åpne sug- og returventilene og start pumpa (slå av elvarmer først). Spyl 1–3 minutter, til vannet i seglasset er klart.',
        '5. Stopp pumpa, vri til RENSPOLNING og spyl 15–30 sekunder.',
        '6. Stopp pumpa, vri til FILTER, steng avløpsventilen og start pumpa igjen.'
      ] },
      { title: 'Ventilstillinger', items: [
        'FILTER: vanlig drift. BACKSPOLNING: rengjør sanden. RENSPOLNING: legger sanden til ro.',
        'AVLOPP: bunnsuging rett til avløp, eller tømming. CIRKULATION: vannet går forbi filteret. STÄNGD: stengt.'
      ] },
      { title: 'Pumpa', items: [
        'Pumpa må være fylt med vann før start. Tørrkjøring ødelegger akseltetningen.',
        'Kjør den aldri mot en stengt ventil.',
        'Etter start kan den bruke 1–3 minutter på å suge ut lufta.',
        'Bryt strømmen før du gjør noe på pumpa.'
      ] },
      { title: 'Hvis noe er galt', tone: 'alert', items: [
        'Høyt trykk på manometeret: tilbakespyl filteret.',
        'Lekkasje eller elektrisk feil: ring fagfolk. Pumpe, UV og motstrømsanlegg skal ha jordfeilbryter.'
      ] }
    ],
    kilder: ['Manual sandfilter 525–905 s. 1–2', 'Pahlén P-01 s. 3–5', 'Poolguiden 2019 s. 14, 22–23, 28']
  },
  {
    id: 'basseng-utstyr', title: 'UV-rensing, motstrøm og bassengtrekk', kategori: 'Basseng', icon: 'Waves',
    model: 'Pahlén Auto-UV · Jet Swim 2000 · CR-15 opprullingsrull',
    intro: 'UV-anlegget renser vannet så det trengs mindre klor. Motstrømsanlegget gir svømmestrøm. Rullen ruller trekket av og på.',
    blocks: [
      { title: 'UV-anlegget', items: [
        'Går bare når vannet strømmer. Seglasset på toppen viser blått lys når lampa virker. Sjekk det hver uke.',
        'Displayet viser driftstimer. Det blinker fra 8000 timer, og ved 9000 timer slår anlegget seg av. Bytt lampa og hold reset inne ca. 5 sekunder.',
        'Rengjør kvartsglasset ca. hver 1000. time med Pahléns rensevæske. Bruk hansker, og slå av strøm og vann først.',
        'UV-lys skader øyne og hud. Er du i tvil, ring installatøren.'
      ] },
      { title: 'Motstrømsanlegget (Jet Swim)', items: [
        'Start og stopp med knappen «on/off» på stålfronten. Vrideren «flöde» stiller styrken, og «luft» blander luft inn i strålen.',
        'Si fra til andre før du starter, og hold minst 0,5 m fra munnstykket.',
        'Pass på langt hår ved innsuget under fronten.',
        'Små barn skal ikke være i bassenget mens anlegget går.'
      ] },
      { title: 'Bassengtrekket (CR-15)', items: [
        'Motorenheten har strømbryter (O / I / II), sikkerhetslås med nøkkel og velger for AUTO eller MANUAL. Det følger med sveiv for manuell drift.',
        'Rullen går på en utskiftbar batteripakke med lader.',
        'Blinker laderen rødt og blått om hverandre, er batteriet eller laderen trolig defekt. Kontakt Bassengutstyr AS.'
      ] }
    ],
    kilder: ['MA60-19 s. 3–5', 'Manual Jet Swim 2000 s. 2–3', 'CR-15 manual s. 1–2', 'E-post fra Bassengutstyr AS om trekket (2020)']
  },
  {
    id: 'avfukter', title: 'Avfukting i bassengrommet', kategori: 'Basseng', icon: 'Droplets',
    model: 'Dantherm CDP 40/50/70 med fjernkontroll DRC1',
    intro: 'Avfukteren holder fuktigheten nede i bassengrommet, så det ikke blir kondens og fuktskader. Lufteåpningene må aldri dekkes til.',
    blocks: [
      { title: 'Slik bruker du det', items: [
        'Displayet viser vanligvis relativ fuktighet (RF %). Blå lampe = strøm/standby, grønn = går eller avrimer, gul = paring med fjernkontroll, rød = feil.',
        'Endre fuktighet på avfukteren: hold OK i 3 sekunder til «rH» vises, trykk OK, still med opp/ned (40–99 %) og trykk OK. Fabrikkinnstillingen er 60 %.',
        'Endre fuktighet på fjernkontrollen: hold Enter i 3 sekunder, endre med venstre/høyre og bekreft med Enter.',
        'Etter at den har vært av, går det 30 sekunder til 6 minutter før kompressoren starter igjen. Det er normalt.'
      ] },
      { title: 'Fast vedlikehold', items: [
        'Hver måned: åpne de to låsene under avfukteren, løft av fronten og vask filteret i lunkent såpevann (eller støvsug det). Rengjør også dryppskåla og avløpet.',
        'Hvert år: ettersyn av fagperson, og kondensatoren støvsuges.'
      ] },
      { title: 'Koder i displayet', tone: 'alert', items: [
        'LO: kontakten med fjernkontrollen er borte. Trykk OK når den er tilbake.',
        'Ab t / Ab rh: temperatur eller fuktighet utenfor driftsområdet. Går over av seg selv.',
        'SE (følerfeil), LP eller HP (trykkfeil): avfukteren stopper. Ring servicetekniker.',
        'Servicesymbol: tid for service. Avfukteren går som vanlig.',
        'Starter ikke kompressoren igjen etter 45 minutter: sjekk vifter og filter, at ingen åpninger er dekket til, og at rommet ikke er varmere enn 36 °C.'
      ] }
    ],
    kilder: ['Dantherm CDP fjernkontroll s. 3–10', 'Dantherm CDP servicemanual s. 6, 15–22, 40']
  },

  // ── Badstu ──
  {
    id: 'badstu', title: 'Badstua', kategori: 'Badstu', icon: 'Flame',
    model: 'Tylö Pure betjeningspanel (art. 2900 5200)',
    intro: 'Panelet ved badstua starter og stopper aggregatet, og stiller temperatur og badetid på en skala fra 1 til 10.',
    blocks: [
      { title: 'Slik bruker du det', items: [
        'Trykk start. Panelet bruker siste temperatur og badetid. Trykk igjen for å slå av før tiden er ute.',
        'Temperatur: velg temperatursymbolet og juster 1–10 med − og +. Med maks 110 °C er trinn 1 ca. 65 °C og trinn 10 ca. 110 °C. Lyset blinker til temperaturen er nådd.',
        'Badetid: stilles mens aggregatet er av, trinn 1–10.',
        'Forsinket start (krever dørkontakt): velg tidsur, sett 1–10 timer og trykk start. Åpnes døra, avbrytes programmet. Trykk da start og lukk døra innen 60 sekunder.',
        'Lysknappen på panelet styrer lyset i badstua. LED-listene sitter under benkene.',
        'Etter strømbrudd blinker lysene en stund mens panelet finner aggregatet. Det er normalt.'
      ] },
      { title: 'Feilkoder', tone: 'alert', items: [
        'Feil vises som blinkende indikatorlys sammen med ett lys på 1–10-skalaen. Fast lys betyr feil 1–10, og blinkende betyr feil 11–20.',
        '1 eller 14: temperaturføler mangler eller er defekt. 7: mistet kontakt med føleren.',
        '3: aggregatet er overopphetet og slår seg av. Det kan startes igjen når det har kjølt seg ned ca. 20 °C. Finn årsaken: dårlig ventilasjon eller smuldrede steiner.',
        '6 eller 15: mistet kontakt mellom panel og aggregat. Prøv å slå strømmen av og på.',
        '16: temperatursikringen har løst ut og må tilbakestilles.',
        '19: døra har stått åpen over 5 minutter, så aggregatet er slått av. 20: døra er åpnet. Sjekk badstua.',
        'Andre feil: noter feilkoden og typeskiltet (type, serienummer, år), og kontakt forhandleren eller Tylö.'
      ] }
    ],
    kilder: ['Tylö Pure installasjon og bruk s. 9–14']
  },

  // ── Solskjerming ──
  {
    id: 'solskjerming', title: 'Motoriserte gardiner', kategori: 'Solskjerming', icon: 'Sun',
    model: 'Luxaflex PowerView · Pebble-fjernkontroll · hub',
    intro: 'Gardinene styres med Pebble-fjernkontrollen eller med PowerView-appen via huben.',
    blocks: [
      { title: 'Slik bruker du det', items: [
        'Velg kanal (1–6) og trykk Åpne eller Lukk. Stopp stanser gardinen. «Alle» kjører gardinene på alle kanalene.',
        'Favoritt: velg kanal og trykk Favoritt. Gardinene går da til den lagrede posisjonen.',
        'Ny favoritt: kjør gardinen dit du vil. Hold Stopp i 6 sekunder til lyset blinker, hold den manuelle knappen på gardinen og trykk Favoritt. Gardinen rykker litt som bekreftelse.',
        'Scener og tidsstyring lages i PowerView-appen.'
      ] },
      { title: 'Legge til eller fjerne en gardin', items: [
        'Hold Stopp i 6 sekunder og velg kanal. Hold den manuelle knappen på gardinen, og trykk Åpne for å legge til eller Lukk for å fjerne.',
        'Ny fjernkontroll: trykk reset på den nye i 6 sekunder, hold Stopp i 6 sekunder på den gamle, hold Stopp på den nye og trykk Stopp på den gamle. Kanalknappene blinker som bekreftelse.'
      ] },
      { title: 'Hvis noe er galt', tone: 'alert', items: [
        'Knappene på fjernkontrollen fortsetter å blinke: hold Stopp i 6 sekunder.',
        'Repeateren blinker oransje: den er ikke koblet til nettverket. Koble den til i appen under Tilbehør → Repeatere.',
        'Fast blått lys på hub eller repeater betyr at alt er i orden.',
        'Dårlig rekkevidde: flytt huben eller repeateren, og ikke plasser den i direkte sol.',
        `Hvordan batteriene i gardinene lades eller byttes, står ikke i FDV ${SJEKK}.`
      ] }
    ],
    kilder: ['Luxaflex PowerView hurtigguide s. 3–20']
  },

  // ── Rom og overflater ──
  {
    id: 'overflater', title: 'Rom og overflater', kategori: 'Rom og overflater', icon: 'LayoutGrid',
    model: 'Romskjema 08.10.2018 (foreløpig, rev. 26.11.2015)',
    intro: 'Hva gulv, vegger og himling er laget av i hvert rom, og hvordan de bør stelles. Skjemaet er foreløpig, så det som er bygget kan avvike.',
    blocks: [
      { title: 'Stell', items: [
        'Slipt betong (mesteparten av huset): tørk opp søl raskt. Hvilke vaskemidler som passer, står ikke i skjemaet.',
        'Parkett (2. etg): bruk en godt oppvridd klut, og ikke la vann bli stående.',
        'Bad: mosaikken i dusjhjørnene har mange fuger. Rengjør dem og sluket jevnlig, og luft godt etter dusjing.',
        'Basseng: flisene ligger mot en membran. Ikke bruk skarpe redskaper i fugene.',
        'Badstu: ikke mal eller lakker trepanelet.',
        'Vinyl (boder og vaskerom): vask med vann, og unngå sterke løsemidler.',
        'Takterrassene: hold sluk og avrenning under terrassebordene fri for løv, fordi tekkingen ligger under.'
      ] }
    ],
    tables: [
      {
        title: 'U.etasje',
        columns: ['Rom', 'Gulv', 'Vegger', 'Himling'],
        rows: [
          ['Kino (1-01)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt, skrår mot skjermen'],
          ['Svømmebasseng (1-02)', 'Slipt betong, fliser rundt bassenget', 'Fliser bak membran', 'Våtromsmaling'],
          ['Soverom 1 (1-02)', 'Slipt betong', 'Sparklet og malt', 'Nedforet, malt'],
          ['Kjellerstue (1-03)', 'Slipt betong', 'Sparklet og malt', 'Malt rett på betong'],
          ['Bad U.etg (1-03)', 'Fliser 20×40, mosaikk i dusj', 'Mosaikk i dusj, ellers malt', 'Sparklet og malt'],
          ['Bassengbad (1-04)', 'Fliser 20×40, mosaikk i dusj', 'Fliser 20×40', 'Sparklet og malt'],
          ['Badstu (1-04)', 'Vinyl med tregulv over', 'Trepanel, lys gran', 'Trepanel'],
          ['Bassengbod (1-04)', 'Vinyl', 'Sparklet og malt', 'Sparklet og malt'],
          ['Sportsbod', 'Vinyl', 'Sparklet og malt', 'Sparklet og malt'],
          ['Bod leilighet (1-05)', 'Vinyl', 'Sparklet og malt', 'Sparklet og malt'],
          ['Bad leilighet (1-06A)', 'Fliser 20×40, mosaikk i dusj', 'Fliser 20×40', 'Sparklet og malt'],
          ['Entré leilighet (1-06)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt'],
          ['Kjøkken/stue leilighet (1-07)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt'],
          ['Soverom 2 (1-09)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt']
        ]
      },
      {
        title: '1. etasje',
        columns: ['Rom', 'Gulv', 'Vegger', 'Himling'],
        rows: [
          ['Garasje (2-01)', 'Betong', 'Isolert sponplate', 'Isolert sponplate'],
          ['Bod (2-02)', 'Vinyl', 'Sparklet og malt', 'Sparklet og malt'],
          ['Vaskerom (2-02)', 'Vinyl', 'Sparklet og malt', 'Sparklet og malt'],
          ['Bad (2-03)', 'Fliser 20×40, mosaikk i dusj', 'Fliser 20×40', 'Våtromsmaling'],
          ['Walk-in (2-04)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt'],
          ['WC (2-05)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt'],
          ['Soverom 3 (2-06)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt'],
          ['Kjøkken/stue (2-08)', 'Slipt betong', 'Sparklet og malt', 'Sparklet og malt'],
          ['Terrasse (2-09)', 'Betong', '–', '–']
        ]
      },
      {
        title: '2. etasje',
        columns: ['Rom', 'Gulv', 'Vegger', 'Himling'],
        rows: [
          ['Soverom 4 (3-04)', 'Parkett 15 mm', 'Sparklet og malt', 'Sparklet og malt'],
          ['Soverom 5 (3-02)', 'Parkett 15 mm', 'Sparklet og malt', 'Sparklet og malt'],
          ['Soverom 6 (3-02)', 'Parkett 15 mm', 'Sparklet og malt', 'Sparklet og malt'],
          ['Bad 2. etg (3-03)', 'Fliser 20×40, mosaikk i dusj', 'Fliser 20×40', 'Våtromsmaling'],
          ['Takterrasser (3-01/3-06)', 'Terrassebord på asfalttekking', '–', '–']
        ]
      }
    ],
    kilder: ['Romskjema 08.10.2018 s. 1 (romnumrene følger skjemaet, som teller U.etasje som 1. etasje)']
  }
];

export const GUIDE_CATEGORIES = [...new Set(GUIDES.map(g => g.kategori))];

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function haystack(g) {
  return norm([
    g.title, g.model, g.intro, g.kategori,
    ...g.blocks.flatMap(b => [b.title, ...b.items]),
    ...(g.tables || []).flatMap(t => [t.title, ...t.rows.flat()])
  ].join(' '));
}

/** Filtrerer på emne og søkeord (alle ordene må finnes; store/små bokstaver og aksenter spiller ingen rolle). */
export function searchGuides(query = '', kategori = 'Alle') {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return GUIDES.filter(g => (kategori === 'Alle' || g.kategori === kategori) && words.every(w => haystack(g).includes(w)));
}
