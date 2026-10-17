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
