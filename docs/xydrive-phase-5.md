# Xydrive Phase 5 — Native Transfers and Transfer Center

- Saved Messages root and verified mounted private-channel destinations.
- File picker, multi-file picker, desktop drop, original document uploads.
- Native attachment upload and DC bandwidth manager; standard Telegram SendMedia, no separate session or file server.
- Native DownloadManager and media loader, with optional progress observer and browser handoff status.
- Two drive jobs at a time, native bandwidth/concurrency limits remain authoritative. Session-only history and retry inputs, no persistent file bytes or transfer metadata.
- Telegram-configured part limits, native multipart retry, explicit retry for known failures, no automatic retry after uncertain message acknowledgement.
- Upload cancellation is cooperative and unavailable once commit starts. Browser-managed download completion/cancellation is outside Xydrive after handoff.
- Duplicate warnings cover currently loaded names only, not an entire unscanned drive.
- Revalidate channel ownership/privacy and file identity; honor native download restrictions. Never pass file bytes to any external service.
- Folder refresh merges the first history page when the currently displayed folder is unchanged; navigating back also loads the current history.

## Validation
Run npm run check:ts, npm run check:css, npm test, npm run build:production. Manually test free/premium file limits, root and mounted folder upload, multiple files, drop, original bytes, folder switch, cancellation during chunk upload, retry, flood wait, uncertain acknowledgement, account switch/lock, browser download handoff, protected content, deleted/changed files, duplicate warning, ordinary chat composer/upload/download, and mobile layout. This commit does not claim authenticated runtime testing.

Cancel all stops queued and cancellable active jobs, not a server commit or browser-owned download. Destination names are captured at enqueue time. Native download observer removal is guarded by the active request identity, and the queue reports its capacity limit.
