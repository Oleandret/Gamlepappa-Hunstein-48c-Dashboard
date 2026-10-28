# Huset: beboere, innlogging og påminnelser

## Tilgang
- **Eier** (`oleandretorjussen@gmail.com` via Google) ser alt. Bare eieren kan endre varmestyringen og se/endre beboernes kontaktinfo og påminnelser (fanen Huset → Beboere).
- **Beboere** logger inn med e-post eller mobilnummer og eget passord. De får bare tilgang til Huset: avvik, gjøremål og husregler. Alt annet (varme, Homey, innstillinger, kontaktinfo) gir 403.

## Slik får en beboer innlogging
1. Eier legger inn e-post og/eller mobil på beboeren under Huset → Beboere.
2. Beboeren går til `/huset`, trykker «Første gang, eller glemt passordet?», skriver e-posten/nummeret og får en 6-sifret kode (gyldig 15 min). Svaret er det samme uansett om adressen finnes, så ingen kan sjekke hvem som bor her.
3. Alternativt lager eier en **invitasjonslenke** (gyldig 7 dager, én gang) og sender den til beboeren.
4. Passord: minst 10 tegn, lagres med scrypt. Økter varer 30 dager, overlever omstart, og avsluttes når passordet endres eller fjernes.

Innlogging begrenses mot gjetting (per IP og per konto).

## Påminnelser
Hver dag til valgt klokkeslett (norsk tid) får beboere med påminnelser slått på en melding om gjøremål som er forfalt eller skal gjøres i dag, og antall åpne avvik. Ingenting sendes når det ikke er noe å si. Logg over utsendinger vises i Beboere-fanen.

## Serveroppsett (Railway)
| Variabel | Formål |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | E-post (koder og påminnelser). Med Gmail: `smtp.gmail.com`, port 465 og et app-passord. |
| `IPHONE_REMOTE_URL`, `IPHONE_REMOTE_USER`, `IPHONE_REMOTE_PASSWORD`, `IPHONE_MCP_TOKEN` | SMS fra iPhonen via iphone-remote (koder, påminnelser og varsel om nye avvik til den det gjelder). |
| `AUTH_PUBLIC_ORIGIN` | Brukes i invitasjonslenker og lenken i påminnelsene. |

Uten e-post/SMS fungerer invitasjonslenker, men koder og påminnelser sendes ikke.
