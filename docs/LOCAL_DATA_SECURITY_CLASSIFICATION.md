# FlexiKit Local Data Security Classification

> Status: S4.3 baseline
> Scope: Browser Web + Windows Desktop local persistence
> Server PostgreSQL business data is out of scope for this local-storage classification.

## 1. Classification levels

FlexiKit uses four local-data classes.

### L0 — Operational / preference data

Examples: theme, layout appearance, sidebar state, category order, cookie-consent state.

Requirements:

- plaintext local persistence is acceptable,
- must still have a documented clear/reset path,
- must not silently accumulate unrelated personal content.

### L1 — Personal metadata

Examples: email/profile cache, avatar, weather city, client-instance identifier, monitor/device presentation metadata.

Requirements:

- do not log unnecessarily,
- include in privacy/clear/delete lifecycle when account- or person-related,
- do not treat as an authentication factor or secret.

### L2 — Sensitive local content / activity

Examples: notes, todos, local file/folder paths, recent files, installed-app usage, tool usage history, custom-tool local paths, diagnostic error strings.

Requirements:

- local-only does not mean non-sensitive,
- no implicit upload,
- must be represented in clear/export/delete design,
- should be scoped per user/device deliberately,
- avoid plaintext diagnostic logging of the content itself,
- encryption at rest may be required where the content risk justifies it.

### L3 — Secret / credential material

Examples: Access Token, Refresh Token, future API keys/passwords/secrets.

Requirements:

- never log,
- never include in normal data export,
- Desktop persistent storage must use an OS-protected secret store,
- Browser Web must not claim JavaScript-side encryption as equivalent protection when the key is available to the same JavaScript context,
- revocation and expiry remain mandatory even when storage is encrypted.

## 2. Current Browser / WebView storage inventory

| Store / key | Actual content | Class | Current protection | Current lifecycle |
| --- | --- | --- | --- | --- |
| Browser runtime memory | Browser Access Token | L3 | memory-only; no normal Web Storage persistence | lost on reload and reissued through active Refresh Session |
| HttpOnly Cookie `flexikit_refresh_session` | Browser Refresh Token | L3 | HttpOnly; SameSite=Strict; Path=/; Secure in production | rotated by server; cleared on logout/account delete |
| localStorage `flexikit-browser-refresh-session-expires-at-v1` | non-secret Browser Refresh Session expiry marker | L0 | plaintext metadata only | cleared when auth state is invalidated |
| localStorage `flexikit-auth-client-instance-id-v1` | random UUID v4 installation/browser-instance label | L1-low | plaintext | intentionally device/browser scoped; not a credential |
| localStorage `flexikit-profiles` | email, display name, avatar/data-image, avatar type, created_at keyed by profile | L1 | plaintext | persists across normal logout today |
| localStorage `gtb-custom` | custom Tool objects including URL, optional localPath/local_path and custom icon | L2 | plaintext | tools store clears on logout |
| localStorage `gtb-favorites`, `gtb-order`, `gtb-cat-order` | favorites/category/tool ordering | L0/L1 | plaintext | tools store clears user tool data on logout |
| localStorage `flexikit-global-search-recents-v1` | recent system file/app/folder name, full path, detail, lastOpenedAt; max 40 | L2 | plaintext | device-local; explicit current-device data deletion clears this key (and activity settings apply to usage/search keys) |
| localStorage `flexikit-installed-app-usage-v1` | installed-app name + launch kind + launch target/path + count + lastOpenedAt; max 160 | L2 | plaintext | device-local; explicit current-device data deletion clears this key (and activity settings apply to usage/search keys) |
| localStorage `flexikit-tool-usage-v1` | tool id or name + URL/localPath key + count + lastOpenedAt; max 120 | L2 | plaintext | device-local; explicit current-device data deletion clears this key (and activity settings apply to usage/search keys) |
| localStorage `flexikit-desktop-canvas-v2` / legacy v1 | complete DesktopWidget configs + monitor topology | L2 aggregate | plaintext | device-local; explicit current-device data deletion clears this key (and activity settings apply to usage/search keys) |
| localStorage UI keys | `gtb-theme`, `flexikit-layout`, `flexikit-theme-settings`, sidebar state, category order | L0 | plaintext | partially handled by current local-data clear |
| localStorage cookie consent | consent/preferences | L0/L1 | plaintext | user-data deletion deliberately preserves this device-level preference; UI preference reset is a separate operation |
| localStorage `flexikit-pet-search` | transient search keyword passed from pet window to main window | L1 | plaintext | consumed and removed when main app applies the search |
| localStorage Pet/trending cache | cached tool names/ranking candidates | L0 | plaintext | cache-like data |

No application IndexedDB usage was found in the current Web source.

## 3. Desktop Canvas is a mixed-sensitivity container

`flexikit-desktop-canvas-v2` cannot be classified as only "layout".

Its widget `config` currently carries data with different privacy levels:

- Notes Widget:
  - `noteTitle`,
  - `noteContent` up to 12,000 characters,
  - edit timestamp.
  - Classification: **L2 sensitive user-authored content**.
- Todo Widget:
  - task text,
  - completion state,
  - created timestamp.
  - Classification: **L2 sensitive user-authored content**.
- Folder Widget:
  - remembered root folder full path and name.
  - Classification: **L2 local filesystem metadata**.
- Weather Widget:
  - manually entered city/location string.
  - Classification: **L1 personal location preference**.
- Canvas monitor topology:
  - monitor id/name, geometry, scaling and primary-monitor state.
  - Classification: **L1 device metadata**.
- Widget frames/appearance:
  - position, size, opacity, theme and visual settings.
  - Classification: **L0 preference data**.

Because all of these are serialized into one localStorage document, the container must currently be handled at its highest effective class: **L2**.

Notes/Todo content must not be presented as a password/API-key vault. Users can type arbitrary text, but the current storage is ordinary WebView localStorage.

## 4. Search and usage history

The following are behavioral privacy data, not ordinary UI settings:

### Global search recents

`flexikit-global-search-recents-v1` stores:

- item kind,
- name,
- full local path,
- detail,
- last-opened timestamp.

A local path may expose Windows username, organization/project names, customer names or document names.

Classification: **L2**.

### Installed-app usage

`flexikit-installed-app-usage-v1` keys include:

- normalized app name,
- launch kind,
- launch target.

Launch target may be an executable path/AUMID/URL-like target. Values include frequency and last-opened timestamp.

Classification: **L2**.

### Tool usage

`flexikit-tool-usage-v1` may key usage by tool id or by tool name plus URL/localPath and also stores frequency/last-opened time.

Classification: **L2**.

These datasets are currently device-global rather than account-namespaced.

## 5. User profile cache

`flexikit-profiles` contains:

- email,
- display name,
- avatar,
- avatar type,
- account creation timestamp.

Uploaded avatars may be persisted as `data:image...` content.

The source comment describes this cache as non-sensitive because it excludes passwords. That is too broad for privacy classification: email and uploaded avatar remain personal data.

Classification: **L1 personal metadata**.

No password is cached in this store.

## 6. Credential storage

### Windows Desktop

Access and Refresh Tokens use the native DPAPI Current User vault:

```text
<app_local_data_dir>/auth-vault/access.dpapi
<app_local_data_dir>/auth-vault/refresh.dpapi
```

Classification: **L3**, with compliant Windows at-rest protection for the current Desktop baseline.

The WebView copy is migrated into the vault and removed.
AI Provider BYOK credentials are also L3, but use a separate native DPAPI vault:

<app_local_data_dir>/ai-provider-vault/openai.dpapi
<app_local_data_dir>/ai-provider-vault/gemini.dpapi
<app_local_data_dir>/ai-provider-vault/anthropic.dpapi

The Provider slot set is fixed, vault payloads are bound to their expected Provider, and writes use atomic replacement. These credentials are not authentication tokens, are not placed in the auth-vault directory, are excluded from normal local backup/export, and are never synchronized to PostgreSQL by the S5.1 baseline.

### Browser Web

Current hardened Browser path:

- Access Token -> runtime memory only,
- Refresh Token -> `flexikit_refresh_session` HttpOnly Cookie,
- non-secret Refresh Session expiry marker -> localStorage.
- BYOK Provider API Keys -> runtime memory only; no localStorage/sessionStorage/IndexedDB persistence.

The Cookie uses SameSite=Strict / Path=/ and Secure in production. Browser auth responses in explicit cookie mode omit `refresh_token` from JSON.

Legacy localStorage Access and sessionStorage Refresh copies are migration inputs only: valid old material may be used once to avoid a forced upgrade logout, then the plaintext Web Storage copies are removed.

Classification remains **L3** for the actual credentials, but the Browser no longer normally persists those credentials in JavaScript-readable Web Storage.

This does not eliminate XSS risk: malicious same-origin script can still perform authenticated actions and may observe a live memory Access Token. See `docs/BROWSER_AUTH_STORAGE.md`.

## 7. Desktop diagnostics log

Desktop diagnostics are written as plaintext:

```text
%LOCALAPPDATA%/com.flexikit.desktop/logs/flexikit.log
```

Rotation baseline:

- current file up to 2 MiB,
- 3 backup files,
- approximately 8 MiB maximum total under normal rotation.

Current routine logs are low sensitivity (startup version/OS/arch/PID, shortcut lifecycle, installed-app counts/launch kind, shutdown).

Old builds may have logged raw source paths, OS error details or other context. Stage 6 now restricts newly recorded panic/event data to safe allowlists, while leaving historical local logs untouched; see docs/STAGE6_DIAGNOSTICS.md.

Classification: **L1 by design, L2 possible for free-form error/panic detail**.

Current safeguards:

- CR/LF removed,
- bounded file rotation,
- no normal auth/body/token logging intended.

Remaining requirement:

- diagnostic logging must continue to avoid Token/secret/user-content values,
- future log collection/upload must add explicit redaction and user consent.

## 8. Local database inventory

Current source audit found:

- no application IndexedDB storage,
- no local SQLite database in the Desktop application.

Backend persistence is PostgreSQL and belongs to the server-data lifecycle, not this local-storage classification.

If a local database is introduced later, its schema must be classified before production use rather than being treated as safe merely because it is local.

## 9. Clear / delete / export baseline

### UI preference reset and user-data deletion are separate

Data Management now exposes two intentionally different local operations.

The existing UI-preference reset removes layout/theme/browser notice preferences and resets the UI presentation. It is not presented as a complete privacy wipe.

The separate current-device user-data deletion uses the explicit allowlist in apps/web/src/utils/localDataLifecycle.ts and removes:

- custom Tool cache/order/favorites/category order,
- Desktop Canvas v1/v2 state including Notes/Todo/Folder configuration,
- global search recents,
- installed-app usage,
- tool usage,
- profile cache,
- trending/pet search cache.

The user-data deletion deliberately keeps device preferences and device identity: theme/layout, privacy preferences, local schema marker, client-instance UUID and Cookie-consent preference.

An already-open Desktop Canvas window observes removal of the Canvas storage key, cancels pending persistence and suspends future persistence in that window so old Notes or paths cannot be written back after deletion.

### Account deletion

Account deletion now:

- requires the exact DELETE confirmation text at the server boundary,
- performs business-data deletion in one database transaction with a pessimistic User-row lock,
- keeps surviving Tool favorite counters consistent,
- removes cross-user Favorites pointing at the deleted user's private Tools,
- removes Tool order, Categories, owned Tools and Refresh Sessions before the User,
- clears the Browser Refresh Cookie,
- clears local authentication material through the normal auth-storage lifecycle,
- clears the current device's user-data allowlist.

Other devices may still contain their own device-local copies. FlexiKit cannot remotely erase localStorage or Canvas data on a different offline or separately running device; that device must execute its own local-data clear.

### Export and backup

The Data Management page exposes separate channels:

- server data export: versioned safe-field JSON for account/profile, owned Tools, Favorites, Tool order, Categories and safe authentication Session metadata,
- encrypted local backup: the documented L0-L2 device-local allowlist for recovery,
- Home Tools import/export: a tool-only compatibility feature.

Normal server export excludes password hashes, Access/Refresh secrets, Refresh token hashes, embeddings, diagnostics and device-local Canvas/search/usage history.

Downloaded exports and backups leave FlexiKit's managed storage boundary and must be stored securely.

## 10. Account scope vs device scope

The baseline deliberately contains both account-scoped and device-scoped state:

1. Server account/profile/business/session data is account scoped and covered by server export/delete.
2. Canvas Notes/Todos/Folder paths are device-local user-authored content, covered by encrypted local backup and current-device user-data deletion.
3. Search recents and installed-app/tool usage are device scoped, privacy-gated and covered by current-device user-data deletion.
4. Profile cache is device scoped, optional, privacy-gated and covered by current-device user-data deletion.
5. The client-instance UUID is intentionally device scoped and remains across normal logout and account deletion on that device.
6. Privacy preferences remain device local and are excluded from backup so a restored backup cannot silently weaken the target device's privacy choices.

## 11. S4.3 action matrix

| Class | Storage rule | Current state | Lifecycle status |
| --- | --- | --- | --- |
| L0 preference | plaintext acceptable | device preferences are explicit and intentionally retained by user-data clear | complete for S4.3 |
| L1 personal metadata | minimize; clear/delete lifecycle | profile cache is optional, privacy-gated and included in current-device user-data clear | complete for S4.3 |
| L2 sensitive content/activity | no implicit upload; explicit retention/clear/export | search/tool/app activity is privacy-gated; Canvas is user-authored local content; backup and current-device delete are explicit | complete for S4.3 |
| L3 secret | OS secret store or non-JS browser credential boundary; never normal export | Desktop DPAPI + Browser memory/HttpOnly Cookie; revocation and expiry are server enforced | complete for S4.3 |

## 12. Local encrypted backup baseline

The S4.3 local backup baseline is implemented and documented in docs/LOCAL_DATA_BACKUP.md.

- Device-local L0-L2 recovery data is backed up through an explicit allowlist, not a dump of all localStorage.
- Backup files are encrypted with AES-GCM-256 using a PBKDF2-SHA-256 password-derived key.
- L3 credentials, Browser Refresh Session metadata, DPAPI vault data, client-instance identity, Cookie consent and diagnostics are excluded.
- Restore validates format/schema/account before writes, replaces only allowlisted snapshot state and attempts rollback on a write failure.
- Server personal-data export remains a separate read/export channel and does not restore PostgreSQL.
- Local schema migration is centralized before app mount; schema 0 to 1 covers Canvas v1 to v2 and unsupported future schemas are rejected.

## 13. Privacy settings baseline

The S4.3 privacy settings baseline is implemented and documented in docs/PRIVACY_SETTINGS.md.

- flexikit-privacy-preferences-v1 is a device-local L0 policy record and is not uploaded or included in encrypted backup.
- Search recents, Tool/App usage personalization and local profile cache each have a real enforcement path.
- Disabling a category deletes its existing corresponding L1/L2 data and prevents future read/write use.
- Clear recorded activity removes search/tool/app activity without changing future-recording preferences.
- Canvas Notes/Todos/Folder configuration is treated as user-authored application content, not passive tracking.
- Browser Cookie messaging reflects the current necessary HttpOnly Refresh Cookie and states that analytics Cookies are not enabled.

## 14. Baseline conclusions

Already strong:

- no password cache found,
- no IndexedDB/local SQLite shadow store found,
- Windows Desktop Access/Refresh Tokens are DPAPI-protected,
- Browser Refresh Secret is HttpOnly Cookie protected and Access is memory-only,
- server Session revocation is immediate,
- server export uses an explicit safe-field contract,
- account deletion is transactional and requires explicit confirmation,
- current-device L1/L2 user content has explicit backup and deletion paths,
- open Canvas windows cannot repopulate cleared Canvas persistence,
- local data has an explicit schema marker, migration registry, downgrade protection and rollback semantics.

Remaining future-hardening items are outside the completed S4.3 lifecycle scope:

- Canvas arbitrary user content remains plaintext in WebView localStorage at rest,
- future schema changes must append explicit tested one-step migrations,
- every new local dataset must receive an explicit account/device privacy scope before persistence is widened,
- diagnostics free-form error redaction can be hardened further,
- any future remote diagnostics/telemetry collection must be opt-in and explicitly documented.

This document remains the source-of-truth classification baseline for future local persistence and privacy changes.