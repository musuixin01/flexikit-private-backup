# FlexiKit AI Assistant

Status: S5.2 native desktop assistant baseline completed on 2026-09-27.

## Scope

The S5.2 baseline is complete: a minimal secure end-to-end assistant shell with bounded current-tool context, explicit user-authorized text-file context, explicit on-demand Clipboard context, a session-only Prompt-history privacy policy and local static shortcut actions.

## Runtime flow

1. Windows Desktop exposes /assistant through the existing Vue/Tauri shell.
2. The view loads authenticated platform and BYOK Provider catalogs.
3. Platform mode may use automatic routing or an explicit Provider/model.
4. BYOK mode requires an explicit Provider. The client bridge loads the Key only when Send is pressed.
5. Windows Desktop reads BYOK from the existing DPAPI Current User vault; Browser development mode reads only the in-memory credential store.
6. The authenticated client calls POST /v1/ai/assistant/generate.
7. A successfully opened FlexiKit Tool may become the runtime-only current-tool context.
8. The assistant visibly shows that context and lets the user disable it before sending.
9. The user may explicitly choose one local text file from the assistant through the Windows native file picker; cancellation reads nothing.
10. Desktop validates extension/type/UTF-8/control characters and a 32 KiB byte limit, then returns only basename/extension/content to the WebView.
11. Clipboard text is read only after the user presses the assistant read button; the assistant never polls, subscribes or reads on mount/focus/send.
12. Web and Backend both enforce a 16 KiB UTF-8 byte limit plus control-character checks for Clipboard text.
13. AiAssistantService treats tool metadata, file content and Clipboard content as untrusted user data; file/Clipboard content stays user-role rather than system-role.
14. Shortcut buttons use local static Prompt templates; clicking only stages text in the composer and always requires an explicit final Send.
15. S5.1 Provider routing, retry/fallback, timeout and usage accounting remain the only execution path.

## Privacy boundary

- Prompt and response text are not written to the AI usage ledger.
- The assistant baseline adds no server-side chat/history table.
- The Vue view keeps rendered messages in component memory only; refresh clears them.
- The view does not use localStorage, sessionStorage or IndexedDB for assistant messages.
- BYOK Keys are not returned in assistant responses or Provider catalogs.
- BYOK Keys are not persisted by the Backend and are not registered in the global Provider registry.
- The assistant Controller/Service does not log request bodies, Prompt text, response text or raw Provider credentials.
- Usage accounting receives authenticated userId plus Provider-reported Token usage only.
- Current-tool state exists only in Vue/module runtime memory and is updated only after FlexiKit successfully opens a Tool.
- Current-tool context sends only bounded id/name/category/kind/hostname metadata.
- Local executable/file paths are never included in the current-tool context payload.
- The user can see the current-tool context in the assistant and disable it for a request.
- File access occurs only after the user presses Select File and completes the native file picker.
- The native bridge accepts one UTF-8 text file from a strict extension allowlist, max 32 KiB by UTF-8 bytes, and rejects binary/control-character input.
- env, pem, key, executable and PDF formats are not accepted by the file-context bridge.
- The bridge returns basename, extension and content only; absolute paths never cross from the Desktop picker into the WebView/API payload.
- Selected file content is held in Vue component memory only and can be replaced, removed or disabled before sending.
- Backend validates file metadata/content again. The file body is inserted as user-role context while the system guard only marks it as untrusted user data.
- Clipboard access happens only after the explicit Read Clipboard action; there is no polling, focus listener, mount-time read or send-time read.
- Clipboard text is limited to 16 KiB by UTF-8 bytes, rejects unsupported control characters, and is held in Vue component memory only.
- Clipboard context can be refreshed, removed or disabled before sending; its full text is not rendered by default in the context card.
- Backend validates Clipboard text again and inserts it as a user-role context message; a system guard only marks it as untrusted user data.
- Clipboard text is not stored in PostgreSQL, logs, the usage ledger, localStorage, sessionStorage or IndexedDB.
- Prompt/response history is session-only and exists only in the current Assistant component memory.
- Refreshing or closing the page clears displayed AI messages; there is no server conversation/history table.
- The reserved flexikit-ai-prompt-history-v1 key is cleanup-only compatibility data and is excluded from encrypted local backup.
- Any future local Prompt-history persistence requires a separate explicit opt-in before the policy can change.
- Shortcut definitions are local/static and have no fetch, Tauri, storage or analytics side effects.
- Clicking a shortcut never reads a new file or Clipboard value and never sends automatically.

## API

POST /v1/ai/assistant/generate is protected by JwtAuthGuard.

Request fields:

- message: required text, max 16,000 characters.
- providerId: optional for platform mode; required for BYOK.
- modelId: optional explicit model.
- byokApiKey: optional request-scoped credential, max 32 KiB and single-line only.
- currentTool: optional nested metadata with positive id, name, category, web/local kind and optional hostname. No path field exists in the DTO.
- currentFile: optional user-authorized basename/extension/content object; allowlisted UTF-8 text only, max 32 KiB by UTF-8 bytes, with no path field.
- currentClipboard: optional explicitly read Clipboard text object; max 16 KiB by UTF-8 bytes and no persistence.

The response exposes only normalized assistant text, Provider id, model id and optional finish reason. Raw usage detail and credentials are not returned by this endpoint.

## Client files

- apps/web/src/views/AiAssistant.vue
- apps/web/src/api/ai.ts
- apps/web/src/ai/assistantClient.ts
- apps/web/src/ai/byokCredentialStore.ts
- apps/web/src/ai/currentToolContext.ts
- apps/web/src/ai/currentFileContext.ts
- apps/web/src/ai/currentClipboardContext.ts
- apps/web/src/ai/assistantQuickActions.ts
- apps/desktop/src-tauri/src/assistant_file_context_windows.rs
- apps/web/src/desktop/openTool.ts
- apps/web/src/components/layout/Sidebar.vue
- apps/web/src/router/index.ts

## Backend files

- backend/src/ai/ai.controller.ts
- backend/src/ai/ai-assistant.service.ts
- backend/src/ai/dto/ai-assistant-generate.dto.ts
- existing S5.1 AiService, router, Provider adapters, BYOK factory, resilience and usage accounting.

## Validation

- Backend npm run build: PASS.
- Web npm run build: PASS.
- Backend npm run test:ai-assistant-regression: PASS, including current-tool guards, file/Clipboard prompt-injection containment, file path/extension checks, 32 KiB file limit, 16 KiB Clipboard limit and control-character rejection.
- Web npm run test:ai-assistant-regression: PASS, including explicit file/Clipboard actions, memory-only context state, visible replace/remove/opt-out, no Clipboard monitoring and shortcut actions that stage text without automatic Send.
- Desktop cargo fmt --check: PASS.
- Desktop cargo test assistant_file_context_windows: PASS, 3 passed / 0 failed.
- Backend npm run test:byok-regression: PASS.
- Backend npm run test:ai-resilience-regression: PASS.
- Backend npm run test:type-audit: PASS with explicit_any=0, untyped_request=0, untyped_whole_query=0.
- Web npm run test:ai-history-privacy-regression: PASS.
- Web npm run test:privacy-settings-regression: PASS.
- Web npm run test:data-lifecycle-regression: PASS.

No external live Provider request is claimed by this validation set; the assistant path is validated against the existing mocked/provider regression layer.

## Historical next task (2026-09-27)

At S5.2 completion, S5.3 user behavior events was the next task; this is an archival handoff, not the current execution pointer. As of 2026-10-10 the project is in Stage 6 (performance metrics and v0.5 beta hardening). Always use docs/MASTER_PLAN.md for the active task.
