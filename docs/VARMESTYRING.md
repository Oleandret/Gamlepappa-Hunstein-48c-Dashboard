# Varmestyring – lokal implementasjon

Ny lesefane for brukerens NIBE F1255-12 R EM. Strømsparing og eksisterende funksjoner beholdes.

## Levert

- Navigasjon, lazy lasting og mobiltilpasset visning; autentisert GET `/api/heating`.
- Adapter for faste myUplink GET-adresser. Ingen kontrollkommandoer eller generell proxy.
- Strengt READSYSTEM-scope, serverinjisert tokenkilde, 60 sekunders cache, samtidighetsvern og 429/backoff også for varsler.
- Faktiske navn, kategorier og enheter, søk/filter, separate hente- og måletider, manglende/foreldet/ukjent kvalitet. Tid i Europe/Oslo. Tid uten tidssone tolkes ikke.
- Varseltelling bruker `numItems` fra den paginerte systemresponsen. Det er systemomfang, ikke pumpespesifikk telling. Feil betyr ukjent, aldri null varsler.
- EM behandles som avgitt varmeenergi; ingen COP, strømforbruk eller besparelse avledes uten verifisert grunnlag.

## Tilkobling er ikke aktivert

Produksjonsruten konstruerer adapteren med `enabled: false`. Den leser ingen credentials og utfører ingen myUplink-kall. `oauthReady: false` er bevisst: tokenutveksling, vedvarende hemmelighetslager og callback er ikke ferdigstilt eller aktivert. Det finnes ingen aktiv tilkoblingsknapp.

Neste nødvendige tilgangsarbeid er separat konkret godkjenning av myUplink developer-klient, kun READSYSTEM, eksakt redirect-adresse og sikker serverlagring. Deretter må reell system-/deviceId velges fra autorisert inventar og tokenkontrakten verifiseres. Ikke sett hemmeligheter i klient, repo eller logger. Ingen PKCE-støtte antas uten dokumentert verifikasjon. Ingen tilgang er opprettet i denne leveransen.

Historikk og AI-optimalisering er ikke koblet til varmepumpen. Visningen lover ikke målepunkter som modellen eller abonnementet kanskje ikke eksponerer.

## Samarbeid og verifikasjon

Mac i stuen laget målenormaliseringen, leseadapteren og de første 20 testene. Agentens grensesnittoppgave traff tidsgrensen uten filer; koordineringen bekreftet stopp før lokal ferdigstilling. Én skriver om gangen. Koordinatoren integrerte UI/rute, strammet datavalidering og la til tester for autorisasjon, mutasjonsavvisning, tidssone og separat varselbackoff.

97 tester bestått; produksjonsbygg bestått. Se `verification/heating-tests.txt`, `heating-build.txt` og `heating-browser.txt`. Skjermbilder bruker isolerte testdata. Ingen fysiske kommandoer eller tilgangsendringer utført.

## Kilder

- https://api.myuplink.com/swagger/index.html
- https://api.myuplink.com/swagger/docs/public-v2/swagger.json – ParameterData og AlarmsPaged. Den publiserte filen hadde en ugyldig tom `authorized-groups`-verdi; bare lokal lesekopi ble normalisert, ingen providerendring.
- https://www.abkqviller.no/produkter/varmepumper-og-tilbehor/vaske-vann-varmepumper/vaske-vann-varmepumper-til-bolig/nibe-f1255-r-em-inverter-vaske-vann-varmepumpe/ – modellserie og EM. Ingen ytelsestall fra sidens andre effektvariant brukes.
