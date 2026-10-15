# Voice restoration investigation — 2026-10-15

## Confirmed original contract

At original commit d28cb8f63680e92f18d0269de2b327dfd4f0f721, client/index.html loaded the unversioned `https://unpkg.com/@elevenlabs/convai-widget-embed` in the authenticated document. App.jsx:251–274 created an `elevenlabs-convai` custom element: one existing agent on overview, a second on other sections, no widget on avatar/chat. Both used compact/bottom-right presentation and cyan/purple orb colors. Agent identifiers are in that original source; they are identifiers, not dashboard credentials. No signed URL, ElevenLabs API key, dynamic variables, client tools or parent messaging contract was found in this integration.

The original AIConnection.jsx polled for custom-element registration and treated the call event as active for an arbitrary 90 seconds. Registration did not prove connectivity and the timer did not prove a call ended. The follow-up fix replaces this with “Taleassistent ikke konfigurert”, with no polling/listeners or claim about the separate chat connection. A future isolated voice component must show its actual status inside its own origin.

Provider-side agent tools, public/private status and domain allowlists were not inspected. Existing source alone cannot prove they are still public or that voice commands are harmless. No real agent was called.

## Official documentation

- https://elevenlabs.io/docs/eleven-agents/customization/widget documents the same script/custom element and agent-id contract, public-agent requirement and domain allowlist. It mentions obtaining an existing share link through the provider, but no share link for these agents is available in this repo.
- https://elevenlabs.io/docs/eleven-agents/libraries/java-script documents public agent sessions and the separate server credentials needed for private-agent signed sessions. Do not disable an agent's existing authentication merely to fit the widget.
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia documents secure contexts, user microphone permission and iframe delegation.
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe documents sandbox restrictions. `allow-same-origin` preserves the child origin; it does not make a different-origin child same-origin with its parent. Do not combine it with scripts for a child served from the dashboard origin.

## Recommended concrete restoration

Create a small static voice host on a distinct HTTPS origin, serving only two fixed pages for the two existing agents. Reuse agent selection/colors/labels. No dashboard token, provider API key, dashboard API access or client tools belong on that host. Pin and review an exact widget package version before hosting; the old floating dependency is not a reproducible release input.

Embed the approved origin with `sandbox="allow-scripts allow-same-origin"`, origin-specific microphone delegation and `referrerpolicy="no-referrer"`. Do not add forms, top-navigation, popup or download grants. Keep provider requests inside the child. Parent CSP frame-src must allow only the exact voice origin in addition to the existing avatar. Parent Permissions-Policy should explicitly delegate microphone only to that voice origin and deny camera. Child headers must permit embedding only by the exact dashboard origin, retain necessary provider-only script/connect/media sources and never redirect a frame to the dashboard origin. Do not proxy the child through the dashboard's /voice path.

Show/load it only after the user chooses voice; navigation between overview/other sections replaces the frame and ends the old document. No postMessage bridge is needed for the existing functional contract. Label the parent “Åpne taleassistent” / “Talevindu åpent”, not “online” or “active”. Keep real conversation status inside the widget. If a later status bridge is desired, accept only strict status enums after checking both event.origin and event.source; never relay tokens or executable commands.

This requires no new provider key IF both existing agents already support the documented public widget. If either is private, stop and choose an authenticated SDK integration with its own server credentials; do not weaken it. A verified provider-hosted share link opened with noopener/noreferrer is a lower-infrastructure alternative, but would open a separate page and needs the actual two share URLs, not an inferred URL template.

## Exact missing inputs and approval

1. Approve creating/selecting the separate static HTTPS voice service and its exact origin (including any hosting cost). No suitable existing origin was established.
2. Read-only verification of the two existing agents' authentication, domain allowlists and configured server tools. Then approve adding only the new voice hostname to each allowlist if necessary. This does not modify the existing MCP bridge.
3. Approve parent CSP and microphone Permissions-Policy/iframe delegation for that exact origin. Each user must still grant browser microphone permission when they deliberately start a call.
4. Select/review an exact widget version and provider network requirements, then validate the actual widget on the new host before production. No real microphone/agent call was authorized or performed in this investigation.

A working production voice restoration cannot be completed under the current prohibition on new access grants/production changes. This is a specific origin and microphone-delegation dependency, not missing dashboard credentials. No production configuration was changed.

## Isolated evidence

`verification/voice-isolation.mjs` uses two ephemeral loopback origins and a fake widget document. Chrome assertions passed: parent DOM and parent sessionStorage throw SecurityError; child storage contains no parent token; child cannot obtain frameElement to remove sandbox; microphone policy is enabled only when explicitly delegated; camera is denied. Without delegation, or with opaque sandbox (`allow-scripts` only), microphone policy is disabled. getUserMedia was replaced with a throwing stub: zero calls. External network was blocked: zero external requests. This proves browser boundary behavior, not compatibility of the live vendor widget or agent availability. Harness requires playwright-core and local Chrome; test used /tmp/dashboard-browser-check dependencies.
