# Xydrive Phase 4 — native media integration

Reuse Web A's MediaViewer, VideoPlayer, AudioPlayer, mediaLoader, progressive loader, worker media cache and intersection observer. No independent playback implementation or external service.

History metadata includes only native pictogram hashes for supported direct media. Thumbnails request native small images when visible, with file icons as fallback. Spoiler, protected, expiring and restricted content is not automatically previewed. Normal photos, non-round videos, supported image/video documents and audio/voice messages have an explicit preview action. Round videos, stickers, PDF and other documents retain Open in Telegram; no custom PDF renderer or automatic downloads.

On explicit preview, the existing authenticated worker verifies mounted channel eligibility and fetches the exact current message. The returned source, media identity, current account and request generation are checked before storing that one message in the standard message store. Native viewer uses an isolated origin (no chat-list ghost animation); native audio uses the single-track source and compact controls. The drive stays mounted during viewing, and its focus trap/keyboard capture is suspended while the native viewer is visible. Source switch, unmount and close invalidate pending preview requests. Native playback may continue after closing the drive, as in Telegram.

## Validation checklist
Run npm run check:ts, npm run check:css, npm test and npm run build:production. Verify root and mounted channel photo/video/audio preview, video seek and fullscreen, closing viewer returns to current folder, search and selection, audio compact play/pause/seek, document fallback, thumbnail scroll, spoiler icon-only rendering, changed/deleted media, permission revocation, account switch and lock, close during preview, and existing chat media behavior. No runtime validation is claimed without running the app.
