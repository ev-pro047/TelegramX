# Xydrive Beta UI audit

Original baseline `bdae90a` in TelegramX. Reviewed again on `021ef924` during the [native client pass](./telegramx-ui-audit.md). The implementation follows TG-Drive’s browsing, selection, inspector and transfer patterns through TelegramX’s native client.

## Checkpoints

1. Compact shell, presentation preferences and account context.
2. Responsive drawer, expandable folder tree and focused workspace tests.
3. Unified collection, metadata, thumbnails and bounded rendering tests.
4. Selection, action menus and permission-aware bulk operations.
5. Search, sorting, folder forms and the shared destination picker.
6. Inspector, native forwarding, text preview and restored drive state.
7. Storage breakdown, scan status and transfer sheet.
8. TypeScript, production bundle, code and style checks, regression tests and simulated workspace flows.

## Verification limits

- The regression suite uses the tracked `src/testSetup.ts` bootstrap. The drive unit cases are under `src/lib/xydrive/`.
- The simulated workspace covers list/grid switching, tree expansion, scoped search, mixed-selection protection, mounted-file actions, inspector and transfers. This fixture uses synthetic data.
- Cloud Chrome could not reach the executor’s localhost. The 320, 360, 390, 430, 844×390, 768, 1024, 1280×720, 1366×768, 1440 and 1920 CSS-pixel browser checks remain pending.
- Telegram login, actual MTProto mutations, forwarding, uploads, downloads and media playback require an authenticated live session. Input fixtures do not exercise those network operations.

## Changed areas

- `src/components/xydrive/` contains the shell, navigation, collection, details, destinations, forms, overview and transfers.
- `src/lib/xydrive/` contains the workspace and collection models, preview guards, transfer history and regression tests.
- `src/global/actions/{api,ui}/xydrive.ts`, `src/global/types/` and `src/api/gramjs/methods/messages.ts` carry the scoped state and verified Telegram requests.
- `src/assets/localization/fallback.strings`, `src/types/language.d.ts` and `src/util/keyboardShortcuts/registry.ts` provide strings and drive shortcut bindings.

## Finding-by-finding disposition

### 01 Workspace Shell

Xydrive shell and Explorer. Compact header, browser/account layout, shared private spacing variables and a shorter action toolbar.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 001 | Consolidate excessive topbar, workspace header and explorer toolbar layers. | Implemented | The title and folder actions share a workspace row. Account identity and Beta are in the navigation header. |
| 002 | Make fixed-width desktop sidebar collapsible or resizable. | Implemented | See this section’s changed area. |
| 003 | Improve surface hierarchy and visual depth. | Implemented | See this section’s changed area. |
| 004 | Standardize corner radii across cards, controls and dialogs. | Implemented | See this section’s changed area. |
| 005 | Remove redundant root breadcrumb/title information. | Implemented | See this section’s changed area. |
| 006 | Add appropriate account/workspace indicator. | Implemented | The navigation header shows the signed-in account name. |
| 007 | Consolidate permanent status and transfer bars. | Implemented | Results pagination appears only when needed. Transfers use a small launcher and a dedicated sheet. |
| 008 | Provide compact/comfortable density options. | Implemented | See this section’s changed area. |
| 009 | Constrain overly stretched overview layouts on large displays. | Implemented | Overview content is capped at 72rem. |
| 010 | Add subtle, reduced-motion-compatible section transitions. | Implemented | See this section’s changed area. |

### 02 Mobile And Responsiveness

Responsive shell, Collection, inspector and transfer sheet. Shared drawer breakpoint covers narrow and short windows.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 011 | Reduce vertical header space before files appear. | Implemented | See this section’s changed area. |
| 012 | Compact search/filter rows on narrow phones. | Implemented | See this section’s changed area. |
| 013 | Consolidate New Folder, Upload and More actions where appropriate. | Implemented | See this section’s changed area. |
| 014 | Replace generic navigation modal with a responsive drawer or mobile navigation. | Implemented | See this section’s changed area. |
| 015 | Make switching drive sections directly accessible. | Implemented | All sections are reachable from the mobile navigation drawer. |
| 016 | Avoid forcing two columns on very narrow phones. | Implemented | See this section’s changed area. |
| 017 | Increase 36px file-action touch targets to accessible sizes. | Implemented | See this section’s changed area. |
| 018 | Improve discoverability and overflow handling of horizontal breadcrumbs. | Implemented | See this section’s changed area. |
| 019 | Make full folder names accessible on touch devices. | Implemented | Full names are available in the action sheet and folder inspector. |
| 020 | Retain essential date/size metadata in mobile list mode. | Implemented | See this section’s changed area. |
| 021 | Use a mobile-optimized details inspector or bottom sheet. | Implemented | See this section’s changed area. |
| 022 | Prevent expanded transfers from consuming most explorer height. | Implemented | See this section’s changed area. |
| 023 | Provide easily reachable create/upload action, e.g. mobile FAB. | Implemented | Upload stays in the action row. New folder is in the workspace toolbar on wide screens and its overflow menu on narrow phones. |
| 024 | Design for short landscape-phone viewports. | Implemented | See this section’s changed area. |
| 025 | Align CSS and JS responsive thresholds and interaction modes. | Implemented | The JavaScript drawer and CSS use the same width and landscape media query. |

### 03 File Cards

Collection, thumbnail and file metadata. High-contrast format tags, separate action area and bounded media loading.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 026 | Remove permanently overlaid checkbox/menu clutter from every grid thumbnail; retain touch discoverability. | Implemented | See this section’s changed area. |
| 027 | Prevent controls from obscuring thumbnails. | Implemented | See this section’s changed area. |
| 028 | Replace uniform primary-accent fallback icons with meaningful file-type styling. | Implemented | See this section’s changed area. |
| 029 | Distinguish PDF, Word, Excel, PowerPoint, archives and other formats. | Implemented | See this section’s changed area. |
| 030 | Support two-line filenames in grid cards. | Implemented | See this section’s changed area. |
| 031 | Keep file extensions visible despite truncation. | Implemented | See this section’s changed area. |
| 032 | Surface relevant file dates in grid metadata where space permits. | Implemented | See this section’s changed area. |
| 033 | Add video play affordances and duration when available. | Implemented | See this section’s changed area. |
| 034 | Add audio playback affordances and duration when available. | Implemented | See this section’s changed area. |
| 035 | Add thumbnail skeleton/loading and smooth reveal. | Implemented | See this section’s changed area. |
| 036 | Handle unavailable/failed thumbnails distinctly and gracefully. | Implemented | Image failures and thumbnail timeouts use the typed file icon. |
| 037 | Avoid excessive thumbnail cropping; use appropriate fit per media type. | Implemented | Media cards keep a consistent frame and fit the full thumbnail within it. |
| 038 | Keep selected and unselected corner radii consistent. | Implemented | See this section’s changed area. |
| 039 | Offer compact and large-preview grid densities. | Implemented | Compact and comfortable density change card spacing and control sizing. |
| 040 | Show per-file preview loading state. | Implemented | See this section’s changed area. |

### 04 Folder Cards

Collection, inspector, folder dialogs and channel worker. Folder commands share selection and authorization rules with the rest of the drive.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 041 | Improve small, visually weak folder cards. | Implemented | See this section’s changed area. |
| 042 | Add direct folder overflow actions. | Implemented | See this section’s changed area. |
| 043 | Support folder selection with the file selection system. | Implemented | See this section’s changed area. |
| 044 | Add folder right-click context menus. | Implemented | See this section’s changed area. |
| 045 | Allow folder management without opening the folder. | Implemented | See this section’s changed area. |
| 046 | Add permission-aware folder rename. | Implemented | Telegram rechecks private-channel ownership before renaming a drive-created channel. |
| 047 | Display indexed item count and/or size without misleading totals. | Implemented | Folder cards show the known indexed count when a snapshot exists. |
| 048 | Improve folder icon hierarchy and differentiation. | Implemented | See this section’s changed area. |
| 049 | Consider optional folder color customization. | Implemented | An account-local folder palette can be set from folder actions. |
| 050 | Add direct folder details action. | Implemented | See this section’s changed area. |
| 051 | Support safe drag-and-drop file organization into folders. | Implemented | Internal drag-and-drop validates destination compatibility and opens confirmation. |
| 052 | Clearly distinguish managed folders from mounted channels. | Already fixed | Managed and mounted labels already existed at the audit baseline. Both are preserved. |
| 053 | Improve long folder-name wrapping and truncation. | Implemented | See this section’s changed area. |

### 05 Sidebar And Navigation

Navigation and workspace preferences. Collapsible indexed tree, scoped search and bounded pages.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 054 | Replace path-sorted flat folder list with an actual expandable tree. | Implemented | See this section’s changed area. |
| 055 | Add expand/collapse controls for nested folders. | Implemented | See this section’s changed area. |
| 056 | Handle deep nesting beyond the four-level indentation cap. | Implemented | The tree retains full logical depth through ARIA levels while keeping labels usable. |
| 057 | Keep navigation manageable with large folder collections. | Implemented | See this section’s changed area. |
| 058 | Add folder context actions in navigation. | Implemented | See this section’s changed area. |
| 059 | Add persistent New action. | Implemented | See this section’s changed area. |
| 060 | Add folder search within navigation. | Implemented | See this section’s changed area. |
| 061 | Clarify Favorites versus Pinned without removing existing capabilities. | Implemented | Favorites and Pinned remain independent. Sorting explains why pinned items appear first. |
| 062 | Remember expanded/collapsed tree state. | Implemented | See this section’s changed area. |
| 063 | Surface storage/index status in navigation where appropriate. | Implemented | See this section’s changed area. |

### 06 Search, Filters And Toolbar

Explorer and collection model. Debounced filename search, native menus, account preferences and index controls.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 064 | Prevent search, sorting, filters and view controls from competing for width. | Implemented | See this section’s changed area. |
| 065 | Replace basic selects with accessible, native-looking Telegram menus where appropriate. | Implemented | See this section’s changed area. |
| 066 | Label sort direction clearly. | Implemented | See this section’s changed area. |
| 067 | Add a search keyboard shortcut. | Implemented | Search has a registered configurable keyboard shortcut. |
| 068 | Highlight matching filename text. | Implemented | See this section’s changed area. |
| 069 | Add convenient category chips or equivalent compact filters. | Implemented | See this section’s changed area. |
| 070 | Clearly show search scope, including descendant folders. | Implemented | Search scope is shown for descendants, loaded results and the indexed library. |
| 071 | Make incomplete index warnings prominent and actionable. | Implemented | See this section’s changed area. |
| 072 | Preserve relevant search/filter/sort preferences across navigation. | Implemented | See this section’s changed area. |
| 073 | Persist grid/list preference across reopening. | Implemented | Grid/list persists per account. |
| 074 | Make resetting active filters easy even when results exist. | Implemented | See this section’s changed area. |
| 075 | Consider extension, date and size filters. | Implemented | Extension filtering is available. Date and size are sortable columns. |
| 076 | Explain pinned ordering or separate pinned items from ordinary sorting. | Implemented | See this section’s changed area. |
| 077 | Make folder visibility under category filters clear and intentional. | Implemented | See this section’s changed area. |

### 07 List View

Unified collection and responsive styles. Sticky sortable columns and narrow layout metadata.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 078 | Add clickable sortable column headers. | Implemented | Name, Type, Date and Size headers sort and show active direction. |
| 079 | Make list header sticky while scrolling. | Implemented | See this section’s changed area. |
| 080 | Provide file-type column at suitable desktop widths. | Implemented | See this section’s changed area. |
| 081 | Unify folder and file row layout. | Implemented | See this section’s changed area. |
| 082 | Add select-all checkbox in list header. | Implemented | See this section’s changed area. |
| 083 | Adapt date/size columns to preserve filename width. | Implemented | See this section’s changed area. |
| 084 | Move size metadata below filename on narrow list layouts. | Implemented | See this section’s changed area. |
| 085 | Add compact/comfortable row density. | Implemented | See this section’s changed area. |
| 086 | Reduce permanently occupied action-column width. | Implemented | See this section’s changed area. |
| 087 | Make desktop double-click/open behavior discoverable. | Implemented | See this section’s changed area. |

### 08 Selection And Bulk Operations

Collection, Explorer and native mutation actions. Matched item selection and serial confirmed file mutations.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 088 | Unify file and folder selection. | Implemented | See this section’s changed area. |
| 089 | Add mobile long-press selection without interfering with scrolling. | Implemented | Long-press uses a movement threshold and cancels on scroll/pointer cancellation. |
| 090 | Add permission-aware bulk move. | Implemented | Up to 100 files per confirmed batch. Every item is rechecked and execution stops on a failed or ambiguous result. |
| 091 | Add permission-aware bulk delete with explicit confirmation. | Implemented | Permanent deletion requires explicit confirmation and reports completed versus requested counts. |
| 092 | Add bulk favorite/pin where supported. | Implemented | See this section’s changed area. |
| 093 | Support mixed file/folder selection with safe operation rules. | Implemented | Mixed selection supports labeling, copying names and downloading its files. Move/delete requires an all-manageable file selection. |
| 094 | Show aggregate selected size, including unknown-size handling. | Implemented | See this section’s changed area. |
| 095 | Distinguish Select Visible from Select All matching items; never imply unloaded items are selected. | Implemented | Page selection and all loaded matches are separate controls. |
| 096 | Handle selection changes under filtering predictably. | Implemented | See this section’s changed area. |
| 097 | Use compact contextual mobile selection toolbar. | Implemented | See this section’s changed area. |
| 098 | Add multi-selection summary to details panel. | Implemented | See this section’s changed area. |

### 09 Context Menus

Item action menu and folder manager. Telegram forwarding loads and checks the original message before opening recipients.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 099 | Group file actions by purpose. | Implemented | See this section’s changed area. |
| 100 | Put destructive actions at the bottom, visually separated. | Implemented | Destructive actions are separated at the bottom. |
| 101 | Remove unnecessary duplicate selection actions where appropriate. | Implemented | See this section’s changed area. |
| 102 | Add mobile-friendly action sheets. | Implemented | See this section’s changed area. |
| 103 | Clearly label Xydrive alias rename versus original filename. | Implemented | Alias form explicitly labels the browser display name and retains the original filename in details. |
| 104 | Add permitted native file-sharing workflow; preserve privacy. | Implemented | Opens the native Telegram forwarding picker after verifying the message. Recipient choice remains with the user. |
| 105 | Provide equivalent folder context menus. | Implemented | See this section’s changed area. |
| 106 | Make menu dismissal on scroll/touch predictable. | Implemented | See this section’s changed area. |

### 10 Details Inspector

Inspector. One-file, folder and multi-selection metadata, location navigation and contextual actions.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 107 | Show media thumbnail or meaningful file icon in details. | Implemented | See this section’s changed area. |
| 108 | Improve metadata grouping and visual hierarchy. | Implemented | See this section’s changed area. |
| 109 | Extend beyond single-file details. | Implemented | See this section’s changed area. |
| 110 | Add folder details. | Implemented | Folder inspector shows type, path and available indexed count. |
| 111 | Add multi-selection details. | Implemented | See this section’s changed area. |
| 112 | Add toolbar control to toggle inspector. | Implemented | See this section’s changed area. |
| 113 | Prevent inspector from excessively squeezing grid. | Implemented | See this section’s changed area. |
| 114 | Add responsive tablet inspector layout. | Implemented | See this section’s changed area. |
| 115 | Make location/path navigable. | Implemented | See this section’s changed area. |
| 116 | Add relevant rename/favorite/move actions to inspector. | Implemented | See this section’s changed area. |

### 11 Dialogs And Forms

Folder and file dialogs and shared destination picker. Permission messaging, progress and navigation from one chooser.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 117 | Polish Create Folder dialog with clear context and feedback. | Implemented | See this section’s changed area. |
| 118 | Add persistent visible folder-name label. | Implemented | Create and rename forms retain a visible folder-name label. |
| 119 | Replace Move Folder dropdown with navigable destination picker. | Implemented | See this section’s changed area. |
| 120 | Replace Move File dropdown with navigable destination picker. | Implemented | See this section’s changed area. |
| 121 | Support deep nested destinations, search and breadcrumbs. | Implemented | See this section’s changed area. |
| 122 | Show channel avatars in Mount Channel list where available. | Implemented | See this section’s changed area. |
| 123 | Improve fixed-height Mount Channel list responsiveness. | Implemented | See this section’s changed area. |
| 124 | Explain mounted versus managed capabilities prominently. | Implemented | Folder management and mount forms state mounted and managed capabilities. |
| 125 | Keep mutation progress and failures visible instead of closing dialogs prematurely. | Implemented | Mutation dialogs show progress and retain any partial or failed outcome. |
| 126 | Replace plain detached mutation status with contextual feedback. | Implemented | See this section’s changed area. |
| 127 | Add appropriate success confirmations for folder operations. | Implemented | See this section’s changed area. |
| 128 | Reuse one accessible destination-picker component. | Implemented | See this section’s changed area. |

### 12 Media Preview

Xydrive media adapter and native viewer. Plain-text preview is capped at 128 KiB and rendered as text.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 129 | Add safe in-drive PDF preview using existing capabilities where feasible. | Deferred | No safe in-drive PDF renderer exists in this checkout. PDF files have download and original-message actions. |
| 130 | Add safe text-file preview where feasible. | Implemented | Allowlisted UTF-8 documents are previewed as plain text with a 128 KiB cap. |
| 131 | Add office-document preview workflow or explicit unsupported fallback; do not pretend conversion is available. | Implemented | Office files have an explicit unsupported-preview inspector with original-message and download actions. |
| 132 | Avoid unnecessarily ejecting users into Telegram chats for unsupported files; offer explicit fallback actions. | Implemented | See this section’s changed area. |
| 133 | Restore explorer context after opening original Telegram messages. | Implemented | Reopening the workspace restores its account, section, folder, search and scroll context. Native history behavior still needs a live test. |
| 134 | Add contextual drive preview actions without replacing native media UI. | Implemented | Drive actions link to preview, download, forwarding and the original message. Native media UI is reused. |
| 135 | Improve contextual preview error feedback. | Implemented | The workspace surfaces preview loading and unavailable/rate-limit feedback. |
| 136 | Indicate previewable file types. | Implemented | See this section’s changed area. |

### 13 Storage Overview

Overview and scan state. Known-size distribution, actual recent opens, largest files and source coverage.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 137 | Improve basic overview metric-card layout. | Implemented | See this section’s changed area. |
| 138 | Add accurate storage distribution chart. | Implemented | Chart segments use only measured file sizes. Unknown sizes are disclosed separately. |
| 139 | Use distinct accessible category colors. | Implemented | See this section’s changed area. |
| 140 | Add category icons. | Implemented | See this section’s changed area. |
| 141 | Make storage breakdown interactive and keyboard-accessible. | Implemented | See this section’s changed area. |
| 142 | Support navigation/filtering from category metrics. | Implemented | See this section’s changed area. |
| 143 | Make folder-usage rows navigable. | Implemented | See this section’s changed area. |
| 144 | Sort folder usage by size or provide sort controls. | Implemented | Folder usage is sorted by known bytes. Unscanned folders show a dash. |
| 145 | Add largest indexed files section. | Implemented | See this section’s changed area. |
| 146 | Add recent activity summary based on actual available data. | Implemented | Activity is based on actual per-file open timestamps available in the account. |
| 147 | Show detailed indexing progress and cancellation/retry. | Implemented | Scan feedback shows active source, pages read and source coverage with stop and retry actions. |
| 148 | Make partial-index and unknown-size status prominent. | Implemented | See this section’s changed area. |

### 14 Transfer Manager

Transfer sheet and existing queue. Duplicate choices, live progress, status filters and history dismissal.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 149 | Remove permanent excessive transfer-panel footprint. | Implemented | See this section’s changed area. |
| 150 | Avoid auto-expanding transfers at the expense of mobile workspace. | Implemented | Active transfers update the launcher without opening the sheet. |
| 151 | Replace restrictive 176px/26vh list cap with adaptive behavior. | Implemented | See this section’s changed area. |
| 152 | Provide dedicated full-size transfer manager or sheet. | Implemented | See this section’s changed area. |
| 153 | Add file-type icons to transfer rows. | Implemented | See this section’s changed area. |
| 154 | Improve upload/download direction icons. | Implemented | See this section’s changed area. |
| 155 | Show numerical progress percentage. | Implemented | See this section’s changed area. |
| 156 | Show aggregate queue progress when computable. | Implemented | See this section’s changed area. |
| 157 | Format ETA in human-readable units. | Implemented | See this section’s changed area. |
| 158 | Add distinct success, failure and cancellation indicators. | Implemented | See this section’s changed area. |
| 159 | Improve duplicate-upload warning and resolution dialog. | Implemented | See this section’s changed area. |
| 160 | Offer per-file duplicate choices where safe and supported. | Implemented | Duplicate names are skipped by default; users can opt in per file within the queue limit. |
| 161 | Identify destination in drag-and-drop overlay. | Implemented | See this section’s changed area. |
| 162 | Add individual dismiss action for completed history items. | Implemented | See this section’s changed area. |
| 163 | Add failed-transfer filter. | Implemented | See this section’s changed area. |
| 164 | Label each progress element accessibly with file and direction. | Implemented | See this section’s changed area. |

### 15 Loading, Empty And Error States

Explorer content states and history pagination. Loading skeletons and explicit recovery controls.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 165 | Improve generic initial workspace spinner. | Implemented | The loaded workspace shows an explorer skeleton. The initial lazy bundle loader remains a native spinner. |
| 166 | Add file-grid skeleton loading. | Implemented | See this section’s changed area. |
| 167 | Add folder-card skeleton loading. | Implemented | The unified loading skeleton reserves card space for the incoming collection. |
| 168 | Improve empty-state visual design and meaningful actions. | Implemented | See this section’s changed area. |
| 169 | Add create-folder action in relevant empty states. | Implemented | See this section’s changed area. |
| 170 | Add concise onboarding explaining Saved Messages and private-channel folders. | Implemented | See this section’s changed area. |
| 171 | Provide unavailable-folder recovery UI. | Implemented | See this section’s changed area. |
| 172 | Clarify or consolidate Load More versus Show Results pagination. | Implemented | See this section’s changed area. |
| 173 | Explain incomplete search results and offer sync/retry. | Implemented | See this section’s changed area. |
| 174 | Consider bounded infinite loading with accessible manual fallback. | Not applicable | The optional infinite-scrolling approach was skipped in favor of bounded page controls and explicit Telegram history loading. |

### 16 Visual Design System

Xydrive styles and existing Telegram variables. Shared spacing, format palettes and reduced-motion-aware transitions.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 175 | Establish coherent Xydrive Beta identity within Telegram design language. | Implemented | See this section’s changed area. |
| 176 | Reduce overuse of primary theme accent for unrelated formats. | Implemented | See this section’s changed area. |
| 177 | Standardize border-radius tokens. | Implemented | See this section’s changed area. |
| 178 | Define consistent typography scale. | Implemented | See this section’s changed area. |
| 179 | Reduce unnecessary border-heavy styling. | Implemented | See this section’s changed area. |
| 180 | Improve primary/secondary surface differentiation. | Implemented | Shell, workspace, cards and status surfaces are visually separated using theme tokens. |
| 181 | Add restrained micro-interactions with reduced-motion support. | Implemented | See this section’s changed area. |
| 182 | Make controls consistent across operating systems. | Implemented | See this section’s changed area. |
| 183 | Clearly differentiate destructive, organizational and navigation actions. | Implemented | See this section’s changed area. |
| 184 | Define accessible file-format color tokens. | Implemented | See this section’s changed area. |

### 17 Accessibility And Interactions

Collection, drawer, navigation and registered shortcuts. Screen-reader labels and keyboard controls.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 185 | Include filenames in selection control accessible names. | Implemented | See this section’s changed area. |
| 186 | Expose favorite/pinned status to assistive technologies. | Implemented | See this section’s changed area. |
| 187 | Add equivalent keyboard selection for folders. | Implemented | See this section’s changed area. |
| 188 | Increase breadcrumb touch targets. | Implemented | See this section’s changed area. |
| 189 | Provide accessible tree navigation and expand/collapse semantics. | Implemented | See this section’s changed area. |
| 190 | Make desktop/touch file-opening behavior intuitive and predictable. | Implemented | See this section’s changed area. |
| 191 | Add concise keyboard shortcuts reference. | Implemented | Drive controls menu explains opening, selection, search and long-press. |
| 192 | Verify Escape/back handling with menus, dialogs, inspector and native media viewer. | Runtime verification pending | Simulated menu and inspector checks ran. Native viewer, browser Back and nested Escape ordering need a live browser/account pass. |
| 193 | Verify contrast in light, dark and custom Telegram themes. | Runtime verification pending | Format colors were checked from CSS. Full contrast through rendered custom themes and states needs a browser pass. |
| 194 | Test font scaling, zoom, virtual keyboard and focus restoration. | Runtime verification pending | Font scaling, zoom, virtual keyboard and focus restoration need a rendered device pass. |

### 18 Large-Library Ux And Performance

Collection, navigation and tab state. Bounded item pages, account-scoped workspace restoration and index snapshots.

| ID | Audit finding | Disposition | Implementation or limit |
| --- | --- | --- | --- |
| 195 | Add grid/list virtualization or equivalent bounded rendering. | Implemented | Each collection page renders at most 48 entries. |
| 196 | Avoid indefinitely increasing DOM size in 120-item batches. | Implemented | Loading older Telegram history adds data while DOM size remains bounded. |
| 197 | Debounce or otherwise optimize search on large indexes. | Implemented | Search uses a 170 ms debounce and memoized result queries. |
| 198 | Bound/virtualize large folder-tree rendering where needed. | Implemented | Navigation renders at most 80 folder rows at once. |
| 199 | Restore folder scroll position during navigation. | Implemented | Scroll offset and page are saved per account and location. |
| 200 | Preserve useful workspace UI state across closing/reopening. | Implemented | View, density, filters, sorting, tree expansion and the most recent location are restored. |
| 201 | Avoid unnecessary repeated indexing; safely scope cached state by account and invalidate on changes. | Implemented | Index snapshots survive same-account close/reopen and invalidation is scoped to changed sources. |
| 202 | Display per-folder indexing status where available. | Implemented | Navigation and storage rows distinguish scanned, partial and unscanned folders. |

## Totals

- Implemented — 196
- Already fixed — 1
- Deferred — 1
- Not applicable — 1
- Runtime verification pending — 3
