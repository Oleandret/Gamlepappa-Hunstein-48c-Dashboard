# Endringsønsker i 3D-modellen

## For eieren
1. Åpne **3D-hus** og trykk **Pek og endre**.
2. Trykk på det som er feil i modellen: en vegg, et møbel, en lampe eller et gulv.
3. Velg hva det gjelder. Listen viser BIM-elementet, møbler og lyspunkter i nærheten, rommet og selve punktet.
4. Velg ett av tre:
   - **Ønsk endring:** skriv hva som skal endres og trykk **Legg til ønske**.
   - **Flytt/fjern:** flytt møbler, lyspunkter og BIM-elementer med pilene (5, 10 eller 50 cm), snu møbler, eller fjern elementet. Endringen lagres med en gang og vises for alle. **Tilbakestill** angrer, og listen «Flyttet/fjernet i modellen» viser alt som er endret. Dører kan bare fjernes.
   - **Koble enhet:** velg en Homey-enhet.
     - Har du trykket på en dør, kobles dørsensoren til døra. Døra åpnes da i modellen når sensoren melder åpen.
     - Ellers festes enheten som pin der du trykket. Pinnen vises også på 2D-plantegningen, og en eksisterende pin for enheten flyttes hit.
5. Når du vil ha ny modell, sier du **«lag ny modell»** til Claude.

Åpne ønsker vises som nummererte nåler i modellen. Trykk på nåleikonet i listen for å fly dit.

## For Claude: «lag ny modell»
1. **Les listen.** Bruk modellnøkkelen. Den gir bare lesing av listen og PATCH av ett ønske.
   ```bash
   TOKEN=$(security find-generic-password -s gamlepappa-house3d-changes -w)
   curl -s -H "Authorization: Bearer $TOKEN" https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app/api/house3d/changes
   ```
   Ta bare ønsker med `status: "ny"`. Merk hvert ønske `pågår` før du starter (se trinn 5).
   Les også det som er flyttet/fjernet direkte i modellen:
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app/api/config/house3dEdits
   ```
   Hver nøkkel er `furniture:<rom>:items:<i>`, `fixture:<rom>:<type>:<i>` eller `bim:<GlobalId>` med `dx`/`dz` (meter øst/sør), `rot` (radianer) og `removed`. Bygg dem inn:
   - **Inventar:** flytt `at` med dx/dz. Ved kvart omdreining roteres boksen og retningsfeltet (`back`/`head`/`face`/`screenTo`); vinkler i mellom trenger ny geometri. Fjernet inventar slettes.
   - **Lyspunkt:** flytt koordinaten, eller slett den.
   - **BIM:** fjernet → `HIDDEN_BIM` (GlobalId). Flyttet → skjul og tegn på nytt i møbleringen, eller la flyttingen stå (`house3dEdits`) hvis den er enkel.
   Når alt er i koden og PR-en er merget, tøm listen slik at flyttingene ikke kommer to ganger. Indeksene endres når inventar slettes, så tøm den i samme runde:
   ```bash
   curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"value":{}}' \
     https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app/api/config/house3dEdits
   ```
2. **Finn elementet** ut fra `target`.

   | `kind` | Hvor i koden |
   |---|---|
   | `furniture` | `elementId` = `<rom>:items:<indeks>` i `ROOM_FURNISHINGS` (`client/src/lib/house3dFurniture.js`) |
   | `fixture` | `elementId` = `<rom>:<type>:<indeks>` i `client/src/lib/house3dFixtures.js` |
   | `bim` / `door` | `globalId`/`meshName` i GLB-en. Skjul med `hiddenBimElement`/`hiddenBimArea`, eller behold med `keepBim`. Tegn nytt i møbleringen. |
   | `room` | rommet i `FLOORS` (`client/src/lib/house3dModel.js`) |
   | `point` | koordinater i meter i etasjens system (x → øst, z → sør, y = høyde over gulv) |

3. **Gjør endringen.** Legg til en test når det er naturlig, og kjør `npm test` og `npm run build`.
4. **Åpne én PR** for alle ønskene. List dem med tekst og element. Eieren merger.
5. **Merk ønskene.**
   ```bash
   curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"status":"gjort","pr":"https://github.com/Oleandret/Gamlepappa-Hunstein-48c-Dashboard/pull/NN","note":"Kort hva som ble gjort"}' \
     https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app/api/house3d/changes/<id>
   ```
   - Bruk `pågår` mens du jobber.
   - Bruk `avvist` med en `note` hvis ønsket ikke kan gjøres.

## Oppsett
- **Railway-variabel `HOUSE3D_CHANGES_TOKEN`:** tilfeldig nøkkel på minst 32 tegn. Den samme nøkkelen ligger i macOS-nøkkelringen på Mac-en til eieren, med tjenestenavn `gamlepappa-house3d-changes`. Den skal aldri inn i repoet eller i chat.
- **Lagring:** ønskene ligger i config-store (`/data/config.json`, namespace `house3dChanges`) på Railway-volumet, ikke i det offentlige repoet.
- **Tilgang:**
  - Lese: alle innloggede.
  - Legge til og slette: admin.
  - Endre status: admin og modellnøkkelen.
  - Flyttinger (`/api/config/house3dEdits`): admin skriver fra 3D-visningen; modellnøkkelen kan lese og tømme.
