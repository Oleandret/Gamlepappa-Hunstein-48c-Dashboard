# Dimmer and voice follow-up — 2026-10-16

## Changes

- Shared 2D/3D controls keep slider edits local and submit once on pointer release, relevant key release or blur. Pointer cancellation discards the edit. Power-on is awaited before dimming; dim-only devices receive no invented onoff command.
- Controls expose pending, rejected and accepted/unconfirmed states. Offline and read-only capabilities are disabled. Group light commands run sequentially and stop on error.
- The application returns command outcomes to controls and preserves accepted-command status when the subsequent status refresh fails.
- Cache invalidation separates in-flight generations so a read started before a write cannot satisfy a subsequent refresh or overwrite the newer cache.
- Validation/queue failures retain 400/429. A failure to record a result after Homey accepted a command is returned as a warning, not a failed physical command.

## Voice: explicit partial restoration

The floating ElevenLabs entry point is restored using the two existing agents and the original section selection (overview versus other sections, hidden on chat/avatar). It opens the provider-hosted agent page in a new tab with noopener/noreferrer. No third-party script, dashboard credential, microphone delegation or message bridge is added to the authenticated dashboard.

Both existing provider pages were loaded read-only in Chrome and displayed “Call AI agent”. Neither button was pressed; no microphone access or conversation was started. This establishes page availability, not end-to-end voice/device functionality.

The provider page sends `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self' https://twitter.com`. Consequently this is a separate-tab launcher, **not a restored inline widget**. Do not remove or proxy around those restrictions.

For an inline widget, the outstanding decision is the distinct HTTPS voice origin described in ../VOICE-ISOLATION.md: select/approve its hosting, verify existing agent allowlists/tools, and approve narrowly scoped parent frame/microphone delegation. No new service, credential, provider permission, CSP relaxation or production setting is part of this change.

## Verification scope

Automated tests use fake devices, fake command senders and in-memory/local test dependencies. They cover slider commit deduplication, keyboard input, cancelled gestures, sequential power/dim writes, failed power-on, dim-only devices, 0/100 bounds, disabled devices, pending double-click suppression, fresh-cache generations, audit failure after acceptance, HTTP status classification, and safe voice-link selection. Existing Google/session/CSRF tests remain in the suite.

The local browser fixture imports the real DeviceControls component but uses only a simulated onSet callback. Physical Homey writes, flow execution, microphone and voice calls are excluded from validation.

Final local results: 44/44 Node 22 tests passed; Vite production build passed. In Chrome, keyboard gestures produced a single dim=0 command, then ordered onoff=true followed by dim=0.1 for 10%. Pending controls were disabled. A simulated rejected dim=0.2 command showed its error and restored the last observed 10% level. No production device command was sent.
