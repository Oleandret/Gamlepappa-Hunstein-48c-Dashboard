# Google owner login — prepared, disabled by default

Opening the ordinary dashboard URL will offer **Fortsett med Google** after activation. Only the exact, verified Google email `oleandretorjussen@gmail.com` receives the existing admin role. Email from the browser is never trusted. Existing bearer keys retain their current roles and remain the recovery path.

## Approval required before activation

This draft does not create a Google OAuth client, change Railway variables, merge, deploy, or create a real user session. Confirm the owner's Google Cloud project before creating an OAuth **Web application** client. If the consent screen remains in testing, add only the owner as a test user.

Register exactly this authorized redirect URI:

`https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app/auth/google/callback`

The only requested scopes are `openid email`. No Gmail inbox/send permission, offline access, refresh tokens, or Gmail connector grant is used. No JavaScript origin is necessary for this server-side authorization-code flow.

After approval, supply these server-only Railway variables through a secure input channel:

- `GOOGLE_CLIENT_ID`: the approved Web application's client ID.
- `GOOGLE_CLIENT_SECRET`: its secret; never paste it into chat, source code, or a URL.
- `AUTH_PUBLIC_ORIGIN`: `https://gamlepappa-hunstein-48c-dashboard-production.up.railway.app` (no trailing slash).
- `GOOGLE_LOGIN_ENABLED`: `true` only after credentials and exact redirect are configured.

Keep `AUTH_TOKENS_JSON` intact. Production readiness continues to require this recovery mechanism. Missing/invalid Google configuration disables Google login while preserving bearer authentication. Do not activate Google login in demo mode.

## Security and operating limits

The server validates Google's RS256 signature using its public JWKS, issuer, audience, expiration, issuance time, nonce, authorized party when supplied, verified email and exact allowlist. Login attempts use single-use state bound to an HttpOnly browser cookie, a nonce and S256 PKCE. Login and API responses are not cacheable; authorization callbacks use `Referrer-Policy: no-referrer`. Provider errors and credentials are never logged.

Sessions are random opaque IDs in `__Host-dashboard-session` cookies (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no Domain). Only a hash of each ID is retained in server memory. Sessions expire after seven days, are revoked on logout, and all are revoked by server restart/deploy. No provider access/refresh token is stored. The in-memory store deliberately supports the current **single replica**. Before scaling to multiple replicas, use a shared expiring session/attempt store; do not just enable a second replica.

Cookie-authenticated writes require the exact configured Origin and a session-bound CSRF token. An explicit Authorization header selects bearer authentication and cannot fall back to a cookie if invalid. Existing role checks and API rate limits remain. CSRF tokens remain in browser memory; session IDs are unavailable to JavaScript.

Google is contacted only during login and public-key refresh. A Google outage blocks new Google logins; existing unexpired local sessions and bearer recovery still work. Disabling `GOOGLE_LOGIN_ENABLED` rejects cookie sessions immediately. After changing environment variables, redeploy/restart clears in-memory sessions. Logout revokes the current browser session only; restarting revokes all sessions. Seven-day sessions do not continuously check Google account status.

## Validation and approved rollout

Automated tests use generated local signing keys, synthetic tokens and stubbed token exchanges. They cover wrong email, unverified email, wrong issuer/audience/nonce/authorized party/signature, token age/expiry, PKCE, one-time state, browser binding, attempt/session expiration, cookie attributes, CSRF, logout, explicit bearer precedence and existing role regression tests. No Homey or production calls are required.

After approval and deployment, manually verify on HTTPS: owner login, account rejection, dashboard read access, reload, logout and recovery-key login. Do not use physical device commands to test login. Verify provider redirect configuration and Railway callback logs do not retain query strings; application logs never print them. Retain the prior secured deployment as rollback, or disable Google login and use the existing key. Do not roll back to an unauthenticated version.
