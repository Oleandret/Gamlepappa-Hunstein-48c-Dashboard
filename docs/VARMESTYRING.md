# Varmestyring og myUplink-lesekobling

Varmestyring viser faktisk eksponerte målepunkter for brukerens NIBE F1255-12 R EM. Manglende, foreldet og ukjent måletid skilles fra ferske målinger. Hentetid erstatter aldri måletid. EM betyr avgitt varme, ikke elektrisk forbruk; ingen COP eller besparelse beregnes uten verifiserte grunnlagsmålinger. Ingen fysisk styring er implementert.

## Implementert tilkoblingsflyt

Eksakt callback:

`https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app/auth/myuplink/callback`

1. Eier logger inn i dashboardet med eksisterende Google-innlogging.
2. Når serveroppsettet er komplett, vises «Koble til myUplink – kun lesing». POST `/api/heating/connect` krever ekte Google-adminsession og eksisterende same-origin/CSRF-kontroll. Bearer- og demo-tilgang kan ikke administrere koblingen.
3. Serveren oppretter tilfeldig engangs-state, PKCE S256 og en HttpOnly/Secure/SameSite=Lax `__Host-`-binding. State er bundet til samme Google-økt, utløper etter 10 minutter og forbrukes også ved feil.
4. Callback utveksler koden server-side, kontrollerer innvilget scope/tokenformat og lagrer bare krypterte tokens. Redirect går alltid til fast dashboardsti. Ingen kode/token/secret logges eller sendes til klienten.
5. Eier henter sine faktiske enheter med GET `/v2/systems/me` og bekrefter system-/deviceId i fanen. Serveren kontrollerer valget mot fersk kontoinventarliste før lagring. Ingen modell-ID gjettes.
6. Leseren bruker faste GET-adresser, 60 sekunders cache, singleflight og backoff ved 429. Varsler er systemomfattende og bruker pagineringens numItems; kildefeil betyr ukjent.
7. Ved godkjent offline-tilgang fornyes tokens server-side, singleflight, med lagring før bruk. HTTP 400 invalid_grant fjerner lokal tilgang; forbigående feil beholder tokens og gir backoff. «Fjern lokal lesetilgang» sletter lokal tokenfil og forhindrer at en sen refresh gjenoppretter den. Dette tilbakekaller ikke provider-granten; eier kan også tilbakekalle appen i myUplink.

## Avskrudd til separat konkret godkjenning

Ingen ekte klient, krypteringsnøkkel, tokenlager, grant eller konfigurasjon opprettes av denne koden ved oppstart. Manglende/ugyldig oppsett gir ikke-konfigurert status uten fil- eller nettverkskall. Nye tilfeldige verdier i tester er kun fixtures/ephemere noncer, aldri produksjonsnøkler.

Før ekte tilkobling må eier godkjenne registrering/bruk av én myUplink-klient for dette dashboardet, `READSYSTEM`, og sikker lagring i denne Railway-tjenesten. Eventuelle API-vilkår må godtas av eier. `offline_access` krever egen godkjenning av varig tilgang/automatisk fornying; uten dette varer tilgangen bare til access-tokenet utløper.

Etter godkjenning legges følgende direkte i Railway-tjenestens beskyttede servervariabler, aldri i chat, klientkode eller Git:

| Variabel | Verdi/formål |
|---|---|
| `MYUPLINK_ENABLED` | `true` først når oppsett og tilgang er godkjent |
| `MYUPLINK_CLIENT_ID` | Registrert klient-ID |
| `MYUPLINK_CLIENT_SECRET` | Klienthemmelighet fra provider |
| `MYUPLINK_TOKEN_KEY` | Separat 32-byte nøkkel kodet som 64 heksadesimale tegn; må opprettes først etter godkjenning |
| `MYUPLINK_TOKEN_FILE` | Absolutt sti på eksisterende privat persistent volum, i egen privat katalog med 0700, for eksempel `/data/myuplink/tokens.json` bare dersom `/data` er verifisert mount |
| `MYUPLINK_OFFLINE_ACCESS_APPROVED` | `true` bare etter særskilt godkjent offline_access, ellers utelatt/false |
| `AUTH_PUBLIC_ORIGIN` | Eksisterende HTTPS-origin for dashboardet, uten avsluttende skråstrek |

Tokens lagres AES-256-GCM-kryptert med tilfeldig IV, autentisert klient/callback-binding, 0600, atomisk rename og fsync. Ingen automatisk nøkkelgenerering eller ukryptert fallback. Privat katalog og ingen symlink kreves. Korrupsjon eller feil nøkkel gir utilgjengelig lager, ikke stille overskriving. Behold nøkkelen sikkert; nøkkelbytte krever kontrollert migrering eller ny tilkobling.

Denne løsningen krever **én serverprosess/replika**, som eksisterende Google-sesjonslager. Restart under innlogging avbryter innloggingsforsøket, men allerede lagrede myUplink-tokens bevares kryptert. Flere replikaer trenger delt lås/state/tokenlager før skalering. Det lille krasjvinduet mellom providerens refresh-tokenrotasjon og lokal lagring kan kreve ny innlogging.

## Offisielle kilder og verifikasjon

Provider metadata kontrollert 17. oktober 2026: https://api.myuplink.com/.well-known/openid-configuration annonserer authorization_code, refresh_token og PKCE S256. Discovery annonserer /connect-adresser, men disse stemmer ikke med de offentlige rutene i Swagger. Etter bekreftet 404 ved innlogging brukes de dokumenterte rutene `https://api.myuplink.com/oauth/authorize` og `/oauth/token`. Autorisasjonsruten svarte HTTP 302 ved kontroll 17. oktober 2026. Adressene er fastlåst; ingen runtime-discovery kan omdirigere hemmeligheter. Kilde: https://api.myuplink.com/swagger/index.html

https://api.myuplink.com/swagger/index.html beskriver READSYSTEM, ParameterData, paginert SystemWithDevices/SystemDevice og AlarmsPaged. Ingen WRITE-scope eller kontrollendepunkt brukes. READSYSTEM er påkrevd; offline_access er eneste mulige ekstrascope bak eget godkjenningsflagg. Ukjente scopes avvises. Tokenrespons uten scope ved første grant avvises; ved refresh uten scope beholdes tidligere verifisert scope. Om provider avviker fra dette må kontrakten undersøkes, ikke utvides stille.

Mac i stuen bidro med den første leseadapteren/målemodellen og uavhengig sikkerhetsreview av OAuth-plan og kode. Koordinator integrerte, testet og verifiserte. Tester og skjermbilder i `docs/verification` bruker isolerte mocks. Ekte myUplink-grant er ikke utført eller end-to-end-testet.

Mac-agentens avsluttende review fant ingen blokkere. To små forbedringer ble tatt inn etter review: manglende tokenpost ved enhetsvalg avvises, og provider-backoff gjelder også nye innloggingsforsøk. Gjentatt samtidig frakobling kan gi én klient en generell feil selv om lokal tilgang allerede er fjernet; dette gjenoppretter ingen tilgang.
