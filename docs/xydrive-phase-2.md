# Xydrive Phase 2 — read-only data engine

The workspace scans Saved Messages history using the existing authenticated GramJS worker and InputPeerSelf. Each request retrieves at most 50 messages, without downloading media bytes. The first page loads on open; older pages require an explicit user action. Text-only pages are not mistaken for an empty library. Raw message IDs drive pagination; only an empty history response is treated as exhausted.

The transient tab state contains normalized file metadata, not file bytes or raw messages. It is cleared when closing the workspace and is excluded from the existing global cache. Requests are deduplicated while a tab is loading. A request generation and account check discard obsolete results after close/reopen, account switch, lock, or disabling the feature. This is logical cancellation: existing in-flight transport requests are not forcibly aborted. Telegram's native short flood-wait handling remains in place; the authenticated worker enforces longer server-requested waits before accepting another Xydrive request.

Supported: direct photos, videos (including round videos), audio, voice messages, documents and stickers. Protected, expiring, restricted, ephemeral and scheduled messages are excluded. Nested rich-message media, paid-media collections, link previews and channel mounting are not in scope. Telegram does not provide a byte size for every media type in its normalized message model; unknown sizes are shown as unavailable. Repeated copies in separate messages remain distinct entries.

## Validation

- npm run check:ts
- npm run check:css
- npm test
- npm run build:production

Manual cases: disabled mode sends no history request; opening an empty account; text-only first page; mixed file types; overlapping and final pages; failed request and retry; flood wait; close while loading; reopen with stale request pending; account switching and passcode lock; desktop and mobile layout; no file payload downloads.

The explorer, search, sorting, preview and transfer controls are later phases. No external authentication, storage service or backend is introduced.
