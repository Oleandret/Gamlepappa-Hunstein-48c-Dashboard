# Local implementation checkpoints

Each version is cumulative and local only. No external writes. Focused checks are repeated at each checkpoint; the complete test and browser evidence belong to V10.

## V1 — Datakvalitet og kildekontrakt

V1: cumulative focused checks passed.

## V2 — Caching, single-flight og backoff

V2: cumulative focused checks passed.

## V3 — Hovedmåler, undermålere og rom

V3: cumulative focused checks passed.

## V4 — Målerhistorikk og Oslo-tid

V4: cumulative focused checks passed.

## V5 — Intervallpriser og delvis kostnadsdekning

V5: cumulative focused checks passed.

## V6 — Forklarbare anbefalinger og avviksvurdering

V6: cumulative focused checks passed.

## V7 — Avgrenset simulering uten styring

V7: cumulative focused checks passed.

## V8 — Skrivebeskyttet Homey-adapter

V8: cumulative focused checks passed.

## V9 — Responsivt grensesnitt og lokal kontroll

V9: cumulative focused checks passed.

## V10 — Integrasjon, mobilkontroll og regresjonsbevis

Fanen er koblet til eksisterende navigasjon og innlogging. Mobiloppsettet begrenses til Strømsparing. Lysvelgeren har eksplisitt tilgjengelighetsetikett. Serverens Oslo-hjelper er uavhengig av klientkilde, slik at eksisterende Docker-pakkestruktur bevares.

Sluttkontroll: 64 av 64 tester bestått; Vite produksjonsbygg bestått. Nettlesertest verifiserte hoved-/undermåler, estimert scenario, eksplisitt lokal aktivering, pause, stopp, logg, 390px uten horisontal overflyt, manglende/foreldede data og eksisterende Enheter/Energi-navigasjon. Null skrivende API-kall og null nettleserfeil. Fem skjermbilder er lagret og skrivebord/mobil/simulering visuelt kontrollert. Google-innlogging, 3D-hus og VoiceAssistant-kildefiler er uendret.

Se `verification/final-tests.txt`, `verification/final-build.txt`, `verification/browser-tests.txt` og `STROMSPARING.md`. Utkastet har ingen fysisk automasjonsmotor, verifisert prisadapter eller AI-kobling. Publisering avventer særskilt godkjenning.

## Integration and alternating review — 17 October 2026

1. Codex recovered all ten local checkpoints, merged latest main and preserved the newer 3D/ElevenLabs changes.
2. Mac i stuen reviewed the design through the existing connector. It identified separate sites and suggested peak-load insight. We deferred tariff-specific advice and inferred appliance identification until actual tariff/history are verified.
3. Codex implemented explicit site membership, unknown-site exclusion, cumulative-meter confirmation, cached 429 reasons and preserved the legacy adapter contract.
4. Mac i stuen independently wrote `server/tests/savings-sites-review.test.js` (four passing tests). Only that file was delegated; one writer at a time. Its suggested billing-ID requirement was discussed and rejected: a formatted identifier does not prove meter membership, and is unnecessary for local insight.
5. Codex removed unsafe totals from the old Energy screen, integrated the independent tests and repeated build/browser/regression verification.

OpenClaw calls timed out at the connector while work continued. Session history was read before any follow-up; no duplicate write was issued. GitHub/Railway publication is authorized by the user's later instruction. Physical control remains out of scope.

## 3D-hus — 20.–21. oktober 2026

- Sol, skygger og dag/natt følger klokka over Hundvåg (modellen dreid 35° etter situasjonsplanen).
- Soverom 3 og resten av 1. etasje møblert etter bilder i Google Drive («Hunstein 48c – rombilder»); BIM-møbler som stemmer beholdes per rom (`keepBim`), feilplasserte skjules.
- Ny uteplass med glasstak utenfor kjøkkenets skyvedør mot sør (målt fra dronebilder); feilplassert BIM-pergola og sørrekkverk skjules. Generiske glassrekkverk tegnes ikke rundt uteområder med egen møblering.
- Garasje: Tesla Model X og Model Y, ingen møbler.
- Etasjene kan spres skrått («Skrått»-bryter), så man ser inn i alle samtidig.
- Egen lesenøkkel for rombilder (`ROOM_PHOTO_READ_TOKEN`), bare GET på `/api/room-photos`.

## 3D-hus — 22. oktober 2026

- U.etasje møblert etter bilder i Drive (IMG_2227–2252): kino (grå vegger, plakater, rødt forheng, mørk sofa med lydabsorbenter; BIM-sofa, hvilestoler, lerret og minibar beholdes), svømmebasseng med naturstein, vannflate, sittesekk og palmer, bad med marmorflis og mørk servant, bod med eikehyller og spilevegg.
- Bassengboden er delt med ny vegg (plantegningen): treningsrom med solarium og tredemølle mot øst, bassengteknikk mot vest.
- Frontenden speiles på Vercel (`client/vercel.json`); `/api` og `/auth` videresendes til Railway. Google-innlogging kan fullføres på Vercel-adressen (`AUTH_EXTRA_ORIGINS`).
- Rettet etter tilbakemelding: teknisk rom vest for kinoen ble aldri bygget (BIM i området skjules, vestveggen er TV-veggen), hvit hjørnesofa i hjørnet, trapp opp til 1. etg mellom kino og soverom, hele veggen mellom basseng og badstu i glass, svarte glassdører fra bassenget til bad og treningsrom, teknisk rom og treningsrom vegg i vegg i bassengboden.
- Lyspunkter fra el-tegningene (el-inst U/1./2. etg, 08.–09.10.2018): 83 spotter, lampepunkter, LED-armaturer i garasjen, LED-lister under benkene i badstua og utelys på takterrassene står der de faktisk sitter (`client/src/lib/house3dFixtures.js`). Symbolene er funnet automatisk på tegningene og registrert mot plantegningene (SIFT + RANSAC, < 1 px). Armaturene gløder og kaster lyskjegle/lysflekk etter Homey-lampene i rommet (nærmeste lampe med pin, ellers sterkeste lampe); avslått vises de grått. Rompanelet viser antall lyspunkter.

## Veiledninger — 22. oktober 2026

- Ny fane **Veiledninger** (også underfane i Huset, så beboerne ser den, og mobilsiden `/veiledninger`): hvordan huset brukes og holdes ved like — varmepumpe, varmeanlegg/tappevann, energimåler, ventilasjon, basseng (vannkvalitet, filter, UV, motstrøm, trekk, avfukter), badstu, motoriserte gardiner og rom/overflater. Skrevet med egne ord ut fra FDV-mappa og romskjemaet 08.10.2018; kilden står på hver veiledning, og usikre punkter er merket «(sjekk)». Søk og emnefilter (`client/src/lib/veiledninger.js`).
- Mangler i FDV: NIBE-brukerhåndbok (menyer og alarmkoder), vedlikeholdsintervaller for varmeanlegget og bytte av batteri i gardinene.

## Pek og endre i 3D-huset — 22. oktober 2026

- **Pek og endre** i 3D-hus: trykk på en vegg, et møbel, en lampe eller et gulv, velg hva det gjelder (BIM-element, møbel, lyspunkt, rom eller punkt) og skriv et endringsønske, eller koble en Homey-enhet dit (dørsensor → døra, andre enheter → pin på stedet, også på 2D-plantegningen).
- Ønskene lagres på serveren (`/api/house3d/changes`, namespace `house3dChanges`) og vises som nåler i modellen. Når eieren ber om «ny modell», leser Claude listen med `HOUSE3D_CHANGES_TOKEN`, gjør endringene i én PR og merker ønskene gjort. Se `docs/ENDRINGSONSKER.md`.
