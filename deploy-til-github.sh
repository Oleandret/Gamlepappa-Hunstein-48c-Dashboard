#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
#  Gamlepappa Hunstein 48c Dashboard — push til GitHub
# ────────────────────────────────────────────────────────────────────────
#  Kjør dette scriptet fra Terminal på Mac-en din:
#
#     cd "/Users/oleandretorjussen/Documents/Claude/Projects/Hunstein 48c dashboardv2"
#     bash deploy-til-github.sh
#
#  Repoet "Oleandret/Gamlepappa-Hunstein-48c-Dashboard" er allerede
#  opprettet som privat. Scriptet:
#    1. rydder eventuell halv-init .git
#    2. lager fersk git-repo
#    3. committer hele prosjektet
#    4. kobler til det eksisterende GitHub-repoet
#    5. pusher
# ────────────────────────────────────────────────────────────────────────
set -e

REPO_OWNER="Oleandret"
REPO_NAME="Gamlepappa-Hunstein-48c-Dashboard"
REMOTE_HTTPS="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
REMOTE_SSH="git@github.com:${REPO_OWNER}/${REPO_NAME}.git"
DEFAULT_BRANCH="main"

cd "$(dirname "$0")"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Gamlepappa Hunstein 48c Dashboard — GitHub-push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1) Rydd opp eventuell halv-init
if [ -d ".git" ]; then
  echo "→ Rydder eksisterende .git-mappe"
  rm -rf .git
fi

# 2) Init og konfig
echo "→ Initialiserer fersk git-repo"
git init -q -b "$DEFAULT_BRANCH"
git config user.email "oleandretorjussen@gmail.com"
git config user.name "Ole Andre Torjussen"

# 3) Sjekk at hemmeligheter ikke følger med
if grep -q "<<LIM_INN_PAT_HER>>" server/config.js 2>/dev/null; then
  echo "  ✓ server/config.js inneholder fortsatt placeholder (trygt å committe)"
else
  echo
  echo "  ⚠️  server/config.js ser ut til å inneholde en ekte verdi."
  echo "     Repoet er privat, men dobbeltsjekk likevel!"
  read -p "     Fortsette med push? [j/N] " confirm
  [[ "$confirm" =~ ^[jJyY] ]] || exit 1
fi

# 4) Stage og commit
echo "→ Legger til filer og committer"
git add .
git commit -q -m "feat: initial commit — Gamlepappa Hunstein 48c Dashboard

- Express-backend med Homey Web API-integrasjon (PAT-basert)
- React/Tailwind frontend i sci-fi Gamlepappa Smarthus-stil
- Droneskudd som husmodell med pulserende rom-pinner
- Energi, sikkerhet, vær (met.no), romtemp, lys, automasjoner
- Demo-modus med rik mock-data
- Klar for Railway-deploy via railway.json + nixpacks.toml"

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "  ✓ commit laget ($COMMIT_SHA)"

# 5) Push — bruker gh CLI hvis tilgjengelig, ellers HTTPS
echo "→ Kobler til ${REMOTE_HTTPS} og pusher"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "  bruker gh CLI for autentisering"
  git remote add origin "$REMOTE_HTTPS"
  gh auth setup-git 2>/dev/null || true
  git push -u origin "$DEFAULT_BRANCH"
else
  echo "  gh CLI ikke autentisert — bruker innebygd git credential-helper"
  git remote add origin "$REMOTE_HTTPS"
  git push -u origin "$DEFAULT_BRANCH" || {
    cat <<EOF

  ⚠️  Push feilet. Sannsynlig grunn: ingen GitHub-credentials tilgjengelig.
      Løsninger:
        a) Installer + logg inn gh:    brew install gh && gh auth login
                                       deretter: bash deploy-til-github.sh
        b) Bruk SSH:                   git remote set-url origin $REMOTE_SSH
                                       git push -u origin $DEFAULT_BRANCH
        c) Bruk Personal Access Token:
           - Lag på https://github.com/settings/tokens (scope: repo)
           - Når git spør om "Username": ditt GitHub-brukernavn
           - Når git spør om "Password": lim inn token

EOF
    exit 1
  }
fi

echo
echo "✅  PUSHET!  Repoet ditt:"
echo "    https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo
echo "Neste steg — Railway:"
echo "  1) https://railway.app  →  New Project  →  Deploy from GitHub repo"
echo "  2) Velg ${REPO_NAME}"
echo "  3) Variables  →  HOMEY_PAT=<din token fra my.homey.app/me>"
echo "  4) Settings → Networking → Generate Domain"
echo "  5) Bokmerk URL-en — du er rett inne, ingen innlogging."
echo
