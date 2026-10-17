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
