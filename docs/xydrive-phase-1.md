# Xydrive Phase 1

Xydrive is an optional experimental workspace within TelegramX. It is disabled by default. Enable it via Settings → Experimental → Enable Xydrive; the main menu then contains Xydrive (Beta).

The workspace is loaded using a separate Web A bundle only on first open. It uses the native Modal, theme variables, localization, and tab-scoped actions. The open state is bound to the current account ID; the workspace closes if the setting is disabled or the account changes. It does not fetch or store media, modify Telegram content, introduce authentication, or add a backend. The Saved Messages button returns to the existing Telegram chat. The data engine is intentionally out of scope.

## Verification

Use a supported Node and npm version (see package.json). Configure the usual independent Telegram development credentials via the upstream setup process. Do not commit credentials.

Run:

- npm run check:ts
- npm run check:css
- npm test
- npm run build:production

Manual checks:

1. Start with a fresh profile or an existing cache. Xydrive is absent from the main menu.
2. In Settings → Experimental, enable Xydrive and return to the main menu. Xydrive appears immediately.
3. Open the workspace. Verify the title, beta indicator, theme, and responsive layout.
4. Close using the header, Escape, browser Back, and the backdrop; verify the previous chat stays intact.
5. Open Xydrive again and use Open Saved Messages; verify the native Saved Messages chat opens.
6. Disable Xydrive and confirm the menu entry is hidden. Repeat with two tabs and an account switch.
7. Check normal chat navigation, media viewer, settings search, and dark/light themes.
8. With DevTools, confirm the Xydrive bundle is not requested until the feature is opened, and that opening does not initiate file retrieval.

Phase 2 will implement the Saved Messages data adapter. No fake file list or storage metrics are shipped in Phase 1.
