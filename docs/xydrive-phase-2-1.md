# Xydrive Phase 2.1 — channel-backed storage

Saved Messages is the root. Explicitly mounted private broadcast channels are first-level folders, following Xyrive's storage model. The folder picker uses already loaded Telegram chats and filters for creator-owned private channels, not groups, public channels, protected or restricted channels. The authenticated worker verifies eligibility through channels.GetChannels at mount and before each folder history page. The root still uses InputPeerSelf.

Mounting does not create, modify, join, leave or delete any Telegram channel. Unmount removes only the local mapping. The registry is stored in existing account settings (and the existing account cache/vault); it is not synchronized between devices. Files themselves remain available in Telegram across devices. Other devices can independently mount the same channels. Folder names follow verified Telegram titles. No extra backend, dependencies or credentials.

Source-specific pagination resets when switching folders; stale responses cannot populate another folder, closed workspace or different account. Native history is read 50 messages at a time, only for the selected source. There is no global scan. The UI retains the native modal and file rows, and adds root breadcrumbs, folder cards, explicit mount picker, folder-specific empty/error states and unmount. No fake upload or creation controls.

## Limitations
- Discovery is limited to chats already loaded by Web A; open a channel in Telegram first if missing.
- This phase mounts existing channels; explicit creation, rename, move/copy and nested organization are reserved for Phase 6. A private channel can have other members; mounting does not make its content personal-only.
- No cross-device folder-registry sync; Phase 8 can evaluate supported synchronization.
- No file preview, downloads, upload, search or large-list virtualization yet.
- Worker verifies channel eligibility at request time; live membership changes between requests are handled on the next request. No claims of perfect instantaneous revocation.

## Validation
Run npm run check:ts, npm run check:css, npm test and npm run build:production. In a test account: mount one owned private channel; reject public, non-owned, protected and inaccessible channels; browse root/folder with overlapping message IDs; verify pagination, stale responses, close/reopen, account switch, passcode lock, unmount without deleting content, persistence after reload, and native theme/mobile behavior. Inspect network for no history fetch for unmounted channels.
