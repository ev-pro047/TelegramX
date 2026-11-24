# Xydrive Phase 3 — Explorer

The native modal, account registry, Saved Messages root, private channel folders, mount and unmount flows remain intact. The explorer adds responsive file grid and list modes, category filtering, filename search, name/date/size/type sorting, ascending/descending direction, visible-item count, selection, a contextual menu and file metadata details. File rows open details, not file contents. The contextual action Open in Telegram uses the existing focusMessage action, and is guarded against stale source and account state.

Search, sorting and select-visible apply only to files loaded for the active folder. The UI distinguishes an exhausted history from a partial scan; it does not claim universal search. Folder cards are separate from file search. Unknown sizes stay last regardless of direction. Selection supports single click, Ctrl/Cmd-click, Shift-click ranges, explicit touch selection, select visible and clear selection. Arrow keys navigate file buttons; Ctrl/Cmd+A within the file list selects visible results. Filtering removes hidden selections and details; source changes and closing the workspace remount its explorer state. No bulk destructive or transfer actions are introduced.

## Validation

Run npm run check:ts, npm run check:css, npm test and npm run build:production. Manual verification: open/close and switch sources; mount/unmount; inspect both views on mobile and desktop; search and filter before and after loading more pages; sort unknown/zero sizes; select using keyboard, pointer and touch; inspect details and context actions; open the original Telegram message; verify account lock and switching do not display previous metadata. Verify dark and light themes, RTL, focus handling, and existing messaging behavior. The new pure helper tests cover search, sorting and selection logic.

No new API calls, dependencies, environment variables or external backend. Media previews, transfers, folder creation and cross-source search remain later work.
