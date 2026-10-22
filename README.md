# Gamlepappa Hunstein 48c Dashboard

Et sci-fi smart-home-dashboard kalt **Gamlepappa Smarthus**, koblet til **Homey Pro** på Hunstein 48c og deployet via **Railway**.

![Gamlepappa Smarthus preview](https://img.shields.io/badge/UI-Gamlepappa Smarthus-22e6ff?style=flat-square) ![Node](https://img.shields.io/badge/Node-22+-3ddc84?style=flat-square) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express-7d5cff?style=flat-square)

## Funksjoner

- **Live oversikt** med stilisert isometrisk husmodell og temperatur-pinner per rom
- **Hurtigkontroller** som kjører Homey Flows (`Hjemmemodus`, `Bortemodus`, `God morgen` osv.)
- **Energiforbruk** med 24-timers graf, sanntids watt og solcelle-bidrag
- **Sikkerhet**: alarmstatus, dør-/vindussensorer, kamera-snarvei
- **Romtemperatur** med fargekodede slidere
- **Belysning**: skru av/på, dimmenivå per lampe
- **Aktivitetslogg** og **favoritt-automasjoner**
- **Vær** for Hunstein via met.no Locationforecast-API
- **Demo-modus** med rik mock-data — virker uten Homey-tilkobling

## Stack

| Lag      | Teknologi                                           |
|----------|-----------------------------------------------------|
| Frontend | React 18, Vite 5, Tailwind 3, Recharts, framer-motion, lucide-react |
| Backend  | Node 20, Express 4, node-fetch                      |
| API      | Homey Web API (cloud relay) + met.no                |
| Deploy   | Railway / Docker (Node 22)                                  |

## Kjør lokalt

```bash
# 1) Klon
git clone https://github.com/<din-bruker>/nexora-hunstein-dashboard.git
cd nexora-hunstein-dashboard

# 2) Konfigurer
cp .env.example .env
# Sett DEMO_MODE=true for isolert demo, eller HOMEY_PAT og AUTH_TOKENS_JSON for live-modus

# 3) Installer
npm run install:all

# 4) Start (kjører server på :8080 og Vite-dev på :5173)
npm run dev
```

Åpne deretter [http://localhost:5173](http://localhost:5173).

> Vil du bare se hvordan det ser ut uten Homey? Sett `DEMO_MODE=true` i `.env` — du får en full mock-versjon med simulert energi-graf, romtemperaturer, lys, sensorer og flows.

## Hent Personal Access Token (Homey Pro)

1. Gå til **[my.homey.app/me](https://my.homey.app/me)**
2. Logg inn → klikk navnet ditt øverst → **Account**
3. Velg **API Keys** → **Create new API key**
4. Gi den et navn (f.eks. *Gamlepappa Smarthus Dashboard*) og scope **Full Access**
5. Kopier tokenet inn i `.env` som `HOMEY_PAT`

Du trenger ikke `HOMEY_CLOUD_ID` — backenden slår den opp automatisk via PAT-en. Men hvis du vil låse den fast finner du Homey-ID-en på samme side.

## Deploy til Railway (innlogging kreves)

API-et krever en tilgangsnøkkel i produksjon. Administrator setter `AUTH_TOKENS_JSON` sikkert i Railway Variables som et JSON-objekt med rollene som skal brukes: `viewer`, `operator` og/eller `admin`. Hver nøkkel må være unik og minst 24 tegn. Ikke legg faktiske nøkler i kildekode, GitHub, logger eller chat.

- `viewer`: lese avlesninger, historikk og konfigurasjon.
- `operator`: i tillegg styre enheter, kjøre flows, bruke chat og kjøre/angre lagrede stemninger.
- `admin`: i tillegg lagre favoritter, pinner, lenker og sceneoppsett, samt administrere automasjoner.

Åpne Railway-URL-en og logg inn med nøkkelen administrator har gitt deg. Nettleseren beholder den bare i økten; «Logg ut» fjerner den. Andre API-klienter må sende `Authorization: Bearer <tilgangsnøkkel>`. Manglende innlogging gir 401, og utilstrekkelig rolle gir 403. Rollene er delte tilgangsnøkler, ikke personlige brukerkontoer eller SSO.

Behold `HOMEY_PAT` og eventuelt `OPENAI_API_KEY` som miljøvariabler. Homey-tokenet er separat fra dashboardets tilgangsnøkkel og skal aldri gis til nettleseren. Hardkodede credentials støttes ikke.

`railway.json` bruker Dockerfile med Node 22, startkommando `node index.js` og readiness `/readyz`. Uten gyldig tilgangsoppsett blir produksjonsdeployen ikke klar. Behold eksisterende configfil på volumet, og kontroller at Docker-brukeren har nødvendige rettigheter før utrulling.

Følg [utrullingsplanen](docs/ROLLOUT.md) og [konfigurasjonslisten](docs/RELEASE-CONFIG-CHECKLIST.md) før merge til Railway-overvåket branch. DB-backup, migrering, TLS og eksisterende klienter må være verifisert. `DEMO_MODE=true` gir bare innloggingsfritak i et isolert miljø som ikke kjører med `NODE_ENV=production`.

## Speil på Vercel (bare frontend)

Vercel-prosjektet bygger React-klienten fra `client/` (rotkatalog `client`, oppsett i `client/vercel.json`). Serveren blir på Railway: Vercel videresender `/api/*` og `/auth/*` til Railway-URL-en, så nettleseren ser alt som samme opprinnelse og ingen hemmeligheter eller miljøvariabler trengs på Vercel. Express-serveren kan ikke flyttes til Vercel som den er, fordi den trenger volumet `/data`, Postgres og bakgrunnsjobbene (poller, prislogger, varmelogger).

- Innlogging med tilgangsnøkkel virker på Vercel-adressen.
- Google-innlogging og myUplink-kobling er bundet til `AUTH_PUBLIC_ORIGIN` (Railway-adressen) og brukes derfra.
- Er Railway nede eller pauset, viser Vercel-siden grensesnittet, men uten data.

Taleassistenten er foreløpig ikke konfigurert. Chat har separat status. Den gamle widgeten lastes ikke inn i dokumentet med øktnøkkelen; se [planen for isolert tale](docs/VOICE-ISOLATION.md).

## Prosjektstruktur

```
nexora-hunstein-dashboard/
├── package.json          # rot-scripts (install:all, dev, build, start)
├── railway.json          # Railway-konfig
├── nixpacks.toml         # Bygge-spec for Railway
├── .env.example          # Kopier til .env
├── server/               # Express-backend
│   ├── index.js          # API + statisk frontend
│   ├── routes/
│   │   ├── homey.js      # /api/homey/*
│   │   ├── system.js     # /api/system/info
│   │   └── weather.js    # /api/weather (met.no)
│   └── lib/
│       ├── homeyClient.js  # PAT-basert Homey Web API-klient
│       └── mockData.js     # Mock-univers for demo-modus
└── client/               # React + Vite frontend
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── lib/api.js
        └── components/
            ├── HouseView.jsx        # SVG-isometri av huset
            ├── EnergyWidget.jsx
            ├── SecurityWidget.jsx
            ├── WeatherWidget.jsx
            ├── RoomTemps.jsx
            ├── Lighting.jsx
            ├── QuickControls.jsx
            ├── ActivityFeed.jsx
            ├── FavoriteAutomations.jsx
            ├── Sidebar.jsx
            ├── TopBar.jsx
            └── Particles.jsx        # Animert bakgrunn
```

## API-endepunkter

| Metode | Sti                                              | Beskrivelse                                |
|--------|--------------------------------------------------|--------------------------------------------|
| GET    | `/api/system/info`                               | Versjon, demo-status, brukernavn           |
| GET    | `/api/homey/zones`                               | Alle soner i Homey                         |
| GET    | `/api/homey/devices`                             | Alle enheter med capabilities              |
| GET    | `/api/homey/flows`                               | Alle flows                                 |
| GET    | `/api/homey/energy`                              | 24t energi-rapport                         |
| GET    | `/api/homey/security`                            | Sikkerhetsenheter + status                 |
| GET    | `/api/homey/activity`                            | Siste hendelser                            |
| POST   | `/api/homey/devices/:id/capability/:cap`         | Skriv capability-verdi (f.eks. onoff)      |
| POST   | `/api/homey/flows/:id/run`                       | Trigge en flow                             |
| GET    | `/api/weather`                                   | Vær fra met.no for lokasjonen i `.env`     |
| GET    | `/healthz`                                       | Healthcheck for Railway                    |

## Tilpasning

- **Navn i hilsen**: endre `user: 'Ole'` i `server/routes/system.js`
- **Lokasjon for vær**: oppdater `HOME_LAT` / `HOME_LON` / `HOME_PLACE` i `.env`
- **Posisjon på rom-pinner**: rediger `ROOM_PINS`-array i `client/src/components/HouseView.jsx`
- **Farger / aksenter**: endre `nx`-paletten i `client/tailwind.config.js`
- **Favoritt-enheter**: pin direkte fra Enheter/Rom-fanene (lagres i nettleseren)

## Discovery — full kartlegging av din Homey

For å la dashbordet (og Claude) vite nøyaktig hvilke enheter, klasser og capabilities du har:

```bash
HOMEY_PAT=<din_token> npm run discover --prefix server
```

Dette skriver `homey-inventory.json` til prosjektroten med:
- Alle enheter, rom og flows (rå-data)
- Klasse-fordeling og capability-statistikk
- Feature-flagg (hasEnergy, hasSecurity, hasClimate, hasLights osv.)
- Spesielle enheter (uvanlige klasser som kan trenge egne widgets)

Du kan også kalle `GET /api/homey/inventory` mot live-serveren for samme data.

Del `homey-inventory.json` med Claude i chatten for å få et dashbord skreddersydd til ditt eksakte oppsett (egne widgets for Tesla-lader, robotgressklipper, sauna, osv.).

## Lisens

Privat prosjekt for Hunstein 48c.
