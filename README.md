# Gamlepappa Hunstein 48c Dashboard

Et sci-fi smart-home-dashboard kalt **NEXORA**, koblet til **Homey Pro** på Hunstein 48c og deployet via **Railway**.

![NEXORA preview](https://img.shields.io/badge/UI-NEXORA-22e6ff?style=flat-square) ![Node](https://img.shields.io/badge/Node-20+-3ddc84?style=flat-square) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express-7d5cff?style=flat-square)

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
| Deploy   | Railway / Nixpacks                                  |

## Kjør lokalt

```bash
# 1) Klon
git clone https://github.com/<din-bruker>/nexora-hunstein-dashboard.git
cd nexora-hunstein-dashboard

# 2) Konfigurer
cp .env.example .env
# Fyll inn HOMEY_PAT (eller la den stå tom for demo-modus)

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
4. Gi den et navn (f.eks. *NEXORA Dashboard*) og scope **Full Access**
5. Kopier tokenet inn i `.env` som `HOMEY_PAT`

Du trenger ikke `HOMEY_CLOUD_ID` — backenden slår den opp automatisk via PAT-en. Men hvis du vil låse den fast finner du Homey-ID-en på samme side.

## Deploy til Railway (åpne uten innlogging)

Dashbordet har **ingen innlogging** — du åpner bare Railway-URL-en, og er rett inne.

1. Push prosjektet til GitHub (privat eller offentlig — du kan gjøre dette uten secrets i koden):

   ```bash
   git init
   git add .
   git commit -m "feat: NEXORA dashboard"
   git branch -M main
   git remote add origin https://github.com/<din-bruker>/nexora-hunstein-dashboard.git
   git push -u origin main
   ```

2. Logg inn på [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → velg dette repoet.

3. Under **Variables** (Railway-fanen for miljøvariabler), lim inn:

   ```
   HOMEY_PAT=<din PAT fra my.homey.app/me>
   NODE_ENV=production
   ```

   Valgfritt:
   ```
   HOME_LAT=60.3913
   HOME_LON=5.3221
   HOME_PLACE=Hunstein 48c
   USER_NAME=Ole
   DEMO_MODE=false
   ```

4. Railway plukker automatisk opp `nixpacks.toml` og `railway.json` (build = `npm run build`, start = `npm start`).

5. Under **Settings → Networking → Generate Domain** får du en URL som `https://din-app.up.railway.app`. Bokmerk den — det er bare å åpne, ingen pålogging.

> **Hvorfor Railway Variables og ikke kode?** Tokenet gir full kontroll over Homey-en din. Selv om du har et privat repo kan tokens lekke (forks, screenshots, samarbeidstilganger). Med Variables ligger det kryptert hos Railway og berøres aldri av git.

### Alternativ: hardkode i `server/config.js`

Hvis du *virkelig* vil ha det i koden (push-and-go uten å sette variabler), åpne `server/config.js` og lim inn PAT-en i `HOMEY_PAT`-feltet. Da vil koden bruke den uansett.
**Husk:** sett repoet til **Private** på GitHub (Settings → Danger Zone → Change visibility) før du committer. Hvis tokenet lekker, gå til my.homey.app/me → API Keys → slett, og lag et nytt.

### Første-deploy uten PAT

Vil du se at alt funker først? Sett `DEMO_MODE=true` i Railway, deploy, åpne URL-en — du får full demo med mock-data. Bytt deretter til `false` og legg inn `HOMEY_PAT` for live-modus.

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
