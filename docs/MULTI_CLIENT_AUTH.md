# FlexiKit Multi-Client Authentication Strategy

> Status: S4.2 baseline
> Clients: Browser Web / Windows Desktop / Browser Companion / future native Mobile
> Session authority: server-side `refresh_sessions`

## 1. Core rule

FlexiKit treats every successful login or registration as an independent Refresh Session.

Logging in on one client does **not** implicitly revoke or replace sessions on other clients.

Examples:

- Desktop login + Web login can coexist.
- Multiple browsers can coexist.
- Browser Companion uses its own independent `extension` Session and can coexist with Web/Desktop.
- Browser Companion v0.4.0 additionally supports an explicit passwordless *one-time pairing flow*: the extension generates a code + private device verifier, an already authenticated FlexiKit user explicitly approves that code, and the extension then exchanges the code with its verifier to mint a NEW independent `extension` session transactionally. Existing Desktop/Web tokens are never copied or shared. See [`BROWSER_COMPANION_ONBOARDING.md`](BROWSER_COMPANION_ONBOARDING.md). This code has passed isolated tests but real PostgreSQL migration and E2E verification are pending.
- A future native Mobile login can coexist with Web/Desktop.
- A second login from the same client instance still creates a separate session.

Automatic replacement/deduplication is intentionally not part of this task. Device Management revokes individual other Sessions by Session UUID, while current-session logout and immediate sid-bound Access revocation are implemented in `docs/LOGOUT_REVOCATION.md`.

## 2. Session identity

Every auth response now exposes:

```json
{
  "session_id": "<refresh-session-uuid>",
  "client_type": "desktop",
  "client_instance_id": "<uuid-or-null>",
  "client_name": "FlexiKit Desktop"
}
```

`session_id` is the stable server-side Refresh Session identifier.

Refresh Token rotation keeps the same `session_id`; only the Refresh Token secret/hash changes.

The session id is not a bearer credential by itself. Possessing it does not authorize API access.

## 3. Client metadata

Login and registration may send:

```json
{
  "client_type": "web | desktop | mobile | extension",
  "client_instance_id": "<uuid-v4>",
  "client_name": "<display label>"
}
```

Validation:

- `client_type`: only `web`, `desktop`, `mobile`, or `extension`,
- `client_instance_id`: optional UUID v4,
- `client_name`: optional, trimmed, 1-80 characters.

Old clients may omit all three fields. The server stores those sessions as:

- `client_type = unknown`,
- `client_instance_id = null`,
- `client_name = null`.

This keeps older applications/API callers compatible.

## 4. Trust boundary

Client metadata is descriptive only.

It must **not** be used as:

- an authentication factor,
- proof of device ownership,
- authorization input,
- a trusted operating-system/browser fingerprint.

A malicious client can claim any allowed `client_type` or display name.

The authoritative session identity remains the random server-side Refresh Session plus possession of the current Refresh Token secret.

## 5. Client instance ID

The current shared Web frontend generates one random UUID v4 and stores it under:

```text
flexikit-auth-client-instance-id-v1
```

This value is non-secret and can remain in localStorage on both Browser Web and Desktop.

Runtime mapping:

- Tauri runtime -> `desktop` / `FlexiKit Desktop`
- Browser runtime -> `web` / `FlexiKit Web`
- Browser Companion -> `extension` / `FlexiKit Browser Companion`
- `mobile` is reserved for a future native Mobile client

A mobile browser remains `web`; `mobile` means a native mobile application contract.

Clearing browser/app WebView site data may create a new client instance ID. That is acceptable: this ID is a convenience grouping key, not durable hardware identity.

## 6. Database model

Migration `1790299800000-AddRefreshSessionClientContext.ts` adds to `refresh_sessions`:

- `client_type varchar(16) NOT NULL DEFAULT 'unknown'`,
- `client_instance_id uuid NULL`,
- `client_name varchar(80) NULL`,
- composite index on `(user_id, client_instance_id)`.

The migration is additive and preserves existing sessions.

Existing rows receive `client_type='unknown'`.

No user/tool data is rewritten.

## 7. Refresh isolation

Refreshing one session:

1. locks only that Refresh Session row,
2. verifies its current secret,
3. rotates only that row's token hash,
4. updates only that row's `last_used_at`,
5. preserves its original client metadata and absolute expiry.

Other sessions for the same user are not rotated, revoked, or otherwise modified.

Refresh requests do not accept client metadata. A client therefore cannot relabel an existing Session during rotation.

## 8. Current privacy boundary

This baseline does not persist IP addresses, User-Agent strings, hardware serials, MAC addresses, advertising identifiers, or browser fingerprints in `refresh_sessions`.

Only client-declared type/name and a random installation/browser-instance UUID are stored.

If Device Management later needs approximate location or richer device descriptions, privacy purpose, retention, user visibility, and spoofing limitations must be defined before collection.

## 9. Device Management integration

Device Management is implemented in `docs/DEVICE_MANAGEMENT.md`.

It now:

- lists active unrevoked Sessions,
- marks the current Session from the Access JWT `sid`,
- displays client labels, login time, last Refresh time and expiry,
- revokes an individual other Session by Session UUID,
- keeps `client_instance_id` as display/grouping metadata only.

Current-session logout and immediate rejection of already-issued sid-bound Access Tokens are implemented. Global logout-all/revoke-all remains a separate future product decision.

## 10. Validation baseline

Static regression:

```bash
npm --prefix backend run test:multi-client-regression
```

Verifies:

- old clients normalize to `unknown/null`,
- Desktop/Web metadata normalization,
- client type / UUID / name validation,
- login/register metadata remains optional.

Live PostgreSQL regression:

```bash
npm --prefix backend run test:multi-client-live
```

Current result verifies:

- Desktop + Web + legacy sessions coexist: 3,
- cross-client login performs no implicit revoke,
- Desktop refresh preserves its Session ID/client metadata,
- Desktop refresh does not rotate Web/legacy hashes,
- Web refresh remains independent,
- legacy metadata remains `unknown/null`,
- deleting the account cascades all Refresh Sessions.

Existing Access Token and Refresh Token live lifecycle regressions also continue to pass.

Migration re-run result:

```text
No migrations are pending
```

Current Web strict build after Device Management: **244 modules**.
