# TelegramX UI and UX audit follow-up

This pass starts from `021ef924`, after the Xydrive audit and workspace polish. The [Xydrive audit](./xydrive-ui-audit.md) retains the individual dispositions for all 202 drive findings.

## Native client checklist

**FIXED** means the change addresses a source-confirmed issue or a specific design finding. **PASS** identifies the scoped check in the evidence column. **DEFERRED** identifies a check that still needs a rendered browser, Telegram test account, device, or assistive technology. An entry about existing code does not establish a live runtime result.

### Shell and responsiveness

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 01 | FIXED | `useAppLayout` and the native shell now share the short-window conditions. The desktop split uses a zero-minimum chat track. |
| 02 | FIXED | The malformed landscape query now parses as separate width and height conditions. The layout regression covers changing between phone, overlay and desktop modes. |
| 03 | FIXED | The tablet drawer uses a fluid width and the chat translates by that same width. |
| 04 | FIXED | The left pane, right pane and chat track have coordinated limits on desktop. Actual drag and split-view behavior still needs a device pass. |
| 05 | DEFERRED | The native right pane, wallpaper, chat header, message list and composer share the 1275 px cutoff in styles. Verify the animated crossing on a rendered client. |
| 06 | DEFERRED | Core overlays use the observed viewport height and safe areas. Test real browser chrome, rotation and the virtual keyboard. |
| 07 | DEFERRED | Resize gestures and width persistence still use `useResize`. Verify drag, reload and breakpoint crossing. |
| 08 | DEFERRED | The native history handlers and Xydrive workspace isolation are exercised in separate paths. Verify the full browser Back stack with authenticated data. |
| 09 | FIXED | The tablet drawer caps its width and stays in the existing overlay mode. |
| 10 | DEFERRED | Fluid dialog and pane bounds are in place. Test 125%, 150% and 200% zoom, OS font size and split-screen clipping. |
| 11 | DEFERRED | Existing reserve measurement and scroll compensation still coordinate the call, pinned and player panes. Test the combined stack with a real chat. |
| 12 | FIXED | Shared pane gutters, drawer offsets and native surface tokens align the desktop and tablet shell. |

### Chat list, folders, menu and accounts

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 13 | FIXED | Chat names expose their full text, and long sender names leave space for previews. The virtual row height and positioning stay fixed. |
| 14 | FIXED | Folder rail labels use 12 px text, wrap to two lines and expose the full name. Rail buttons support Enter and Space. |
| 15 | FIXED | Test accounts have a readable, localized Test server label alongside the account name. |
| 16 | FIXED | The main menu caps width and height and wraps long entries. The full localized short-window check is pending. |
| 17 | FIXED | Long sender names shrink ahead of message previews and indicator slots. Existing timestamps and badges keep their sizing. |
| 18 | DEFERRED | Exercise mixed unread, draft, archive, typing, mention and reaction states on an authenticated fixture. |
| 19 | FIXED | The selected row derives a readable fill from the theme accent. Computed contrast passes for default light, default dark and three custom palettes. |
| 20 | DEFERRED | Incoming-message and folder-switch scroll anchoring needs an authenticated chat history. |
| 21 | DEFERRED | Tabs have keyboard activation and full-name tooltips. Stress-test counts, localization and horizontal scrolling. |
| 22 | DEFERRED | Verify archive gestures, long press and the floating new-chat control on touch. |
| 23 | FIXED | Empty folders use a compact, readable layout with the existing edit-folder action where relevant. |
| 24 | DEFERRED | Test multi-account switching, dismissal and stale notification counters with separate sessions. |
| 25 | PASS | Source review confirms the Xydrive Beta menu item requires both an enabled setting and a signed-in account. |
| 26 | FIXED | Sign-in and Settings both identify TelegramX as an unofficial Telegram client. The native Help entries remain available. |

### Search, contacts and new chat

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 27 | FIXED | Search controls use 44 px touch sizing. The input can shrink in a flex row and retains its accessible name. |
| 28 | DEFERRED | The component regression covers focus, back and clear callbacks. Global search filters, recents and results need an authenticated pass. |
| 29 | DEFERRED | Rapid queries, service latency and reconnect behavior need a networked search fixture. |
| 30 | FIXED | Search result group headings use a consistent hierarchy. The original categories and tabs remain available. |
| 31 | DEFERRED | Test date and sender filters together and result scroll restoration. |
| 32 | DEFERRED | Test contact multiselect and new group or channel forms with narrow windows and long names. |

### Chat header and message history

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 33 | FIXED | The header reserves more touch height and gives titles more space on narrow phones. |
| 34 | FIXED | Back and round chat actions provide 44 px touch targets. |
| 35 | FIXED | The main message column retains its readable maximum on ultrawide displays. |
| 36 | FIXED | Message bubble size caps apply on ultrawide screens as well as desktop. Short landscape phones use the single-pane styles. |
| 37 | DEFERRED | Verify the player, translation, pinned message and active call panes together. |
| 38 | DEFERRED | Inspect sticky dates, unread indicators and jump controls with real history and a growing composer. |
| 39 | DEFERRED | Verify reply, pin, search, topic and unread navigation and retained offsets with networked history. |
| 40 | DEFERRED | Source review confirms text uses overflow wrapping and code keeps horizontal overflow. Mixed-script, table and rich-message rendering needs dedicated fixtures. |
| 41 | DEFERRED | Exercise emoji, albums, polls, locations, voice notes, files and bot keyboards in a test chat. |
| 42 | DEFERRED | Verify timestamp, edit, delivery and retry states at small widths. |
| 43 | DEFERRED | Run the native message selection and confirmation flows with an authenticated test account. |
| 44 | PASS | Source review confirms reply, quote, reaction and file surfaces share the per-message palette. The composer reply controls now share the same touch sizing. |
| 45 | FIXED | Native buttons accept keyboard-generated clicks while preserving the pointer fast path. The regression tests both and checks for duplicate invocation. Hover-only surfaces still need a walkthrough. |
| 46 | FIXED | The composer footer declares an automatic height fallback before `calc-size`. Older-browser animation remains unverified. |

### Composer and attachments

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 47 | DEFERRED | Verify multiline typing, paste, drafts and Send with a real mobile keyboard. |
| 48 | DEFERRED | Reply cancellation has a 44 px touch target. Test reply, edit and forward stacks and attachment captions together. |
| 49 | DEFERRED | Picker, multiple files, drag and drop, compression and upload errors require a test session and files. |
| 50 | DEFERRED | Record, lock, cancel and permission-denied cases need browser media devices. |
| 51 | FIXED | Symbol picker sizing follows the observed viewport and its content and composer offset use the same height. |
| 52 | FIXED | Symbol picker tabs and close controls use 44 px touch targets. |
| 53 | DEFERRED | Test emoji, sticker and GIF interactions and focus restoration in-browser. |
| 54 | DEFERRED | Attachment menus have a viewport height cap. Verify the placement of send-as, scheduled, mention and command menus with real content. |
| 55 | FIXED | Composer spacing and controls follow the same narrow-window and direction rules while retaining the existing action order. |
| 56 | DEFERRED | Test read-only and restricted chats. The permission checks have no changes in this pass. |

### Settings

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 57 | FIXED | Settings has skimmable native groups and allows long labels to wrap. |
| 58 | FIXED | Settings uses flex-safe scrolling and reserves scrollbar space. Nested focus behavior still needs browser verification. |
| 59 | FIXED | General Settings labels its appearance section clearly. The live size and theme update handlers remain in use. |
| 60 | FIXED | Settings groups account and security, preferences, organization and storage, and support. |
| 61 | DEFERRED | Verify every setting through search, highlighting and Back. Both cache entry points call the same confirmation action. |
| 62 | DEFERRED | Verify toggles, radio groups, checkboxes and sliders against actual persisted account and device settings. |
| 63 | DEFERRED | Exercise mobile two-step verification, passcode, passkeys, active sessions and security confirmations on a test account. |
| 64 | DEFERRED | Test long security and exception lists at 200% zoom. |
| 65 | DEFERRED | Test browser permission denial and missing notification capabilities. |
| 66 | FIXED | Local cache clearing describes the operation, uses a native confirmation and waits for a browser outcome. Accurate byte totals are deferred because storage estimates could include unrelated origin data. |
| 67 | DEFERRED | Test wallpaper, custom theme, language, RTL and animation variants end to end. |
| 68 | FIXED | Experimental settings have a separate surface, and Xydrive keeps its beta label and opt-in control. |

### Profile, groups, channels and topics

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 69 | FIXED | Profile and management panels follow the same single-pane mode and honor horizontal safe areas. Verify navigation back to the chat on-device. |
| 70 | DEFERRED | Sticky shared-content tabs have a scroll hint. Verify long biographies, links and photo interactions with real profile data. |
| 71 | DEFERRED | Test large group member and admin lists, search and permissions. |
| 72 | DEFERRED | Verify group or channel creation, invite, edit, leave, report and confirmation workflows. |
| 73 | DEFERRED | Test forum and community tabs, pinned topics and unread state on a populated account. |
| 74 | FIXED | Profile content tabs are labeled, keyboard accessible and indicate horizontal overflow. |
| 75 | DEFERRED | Verify profile edit validation, unsaved changes and keyboard dismissal. |

### Media, stories and calls

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 76 | FIXED | Viewer and zoomed layers use the observed viewport height. Header spacing honors both horizontal safe areas. |
| 77 | FIXED | Player buttons provide 44 px touch targets and the speed menu anchors to its trigger. |
| 78 | DEFERRED | Viewer navigation shows keyboard focus. Verify pinch, swipe, playback controls and fullscreen in-browser. |
| 79 | DEFERRED | Test seek, captions, downloads, background audio and playback failure with actual media. |
| 80 | FIXED | Story overlays use the observed viewport height and short landscape shows the full media frame. |
| 81 | DEFERRED | Verify story progression, pause, reply, loading, volume and audience settings. |
| 82 | FIXED | Call controls wrap on narrow widths and respect safe areas. Real permission and reconnect states remain pending. |
| 83 | FIXED | Group call size follows the viewport and the landscape participant panel has a fluid width. Participant layout still needs a live call. |
| 84 | DEFERRED | Call controls retain keyboard and touch visibility. Verify device permissions, screen share, minimize and hang-up flows. |
| 85 | DEFERRED | Test focus and stacking with calls, media and notifications open together. |

### Shared design, accessibility and performance

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 86 | FIXED | Modal minimum size no longer exceeds the available width at 320 px. Dialog content scrolls within the observed viewport. |
| 87 | FIXED | Search, chat, picker and media controls receive larger touch targets where space permits. Compact desktop variants remain available. |
| 88 | FIXED | Menus have fluid width bounds and a short-window scroll cap. Verify anchored portals with keyboards in a real browser. |
| 89 | FIXED | Shared media conditions and native theme and spacing tokens coordinate panes, menus and overlays. |
| 90 | DEFERRED | Selected chat colors have a numeric contrast regression. A complete rendered contrast sweep remains pending. |
| 91 | DEFERRED | The native search and invalid-field tests verify naming, focus and keyboard activation. Full tab order, focus trapping and restoration need browser checks. |
| 92 | DEFERRED | Existing motion settings and animation guards remain in place. Verify OS reduced motion and in-app animation modes. |
| 93 | DEFERRED | Verify announcements on a screen reader for incoming messages, invalid fields, unread counts and transfers. |
| 94 | DEFERRED | Logical spacing was applied to affected controls. A localized RTL and mixed-script walkthrough remains pending. |
| 95 | FIXED | Sign-in reports the connecting state, local cache feedback distinguishes successful and failed clears, and empty chat/folder layouts have clearer spacing. |
| 96 | DEFERRED | Record scroll FPS, input latency, memory and shifts on a low-end Android device with a populated account. |
| 97 | PASS | Source and diff review show the native fast list, history windowing and media caching and lazy-loading paths remain in use. Xydrive keeps bounded results. Device performance profiling is pending. |
| 98 | DEFERRED | Test PWA standalone, refresh, reconnect and history with a real session. |
| 99 | DEFERRED | Keyboard activation has regression coverage. Verify shortcut conflicts and text selection across the full client. |
| 100 | DEFERRED | Automated build, unit and smoke checks ran. Before-and-after screenshots and the rendered device matrix could not run in this environment. |

### Authentication

| ID | Status | Evidence or remaining check |
| --- | --- | --- |
| 101 | FIXED | Auth forms use adaptive padding and viewport height. QR scales within its original SVG viewBox and the phone form no longer reserves an arbitrary minimum height. |
| 102 | DEFERRED | Source inspection confirms native phone, QR and passkey entry points. Actual one-device login needs a test account. |
| 103 | DEFERRED | The OTP field supports system autofill and strips repeated separators from pasted codes. Test OTP delivery, country picker, timers, password and registration. |
| 104 | DEFERRED | QR return and password paths remain in the standard sign-in flow. Expiry, refresh and error states need a Telegram test session. |
| 105 | FIXED | Sign-in identifies the client, announces connection progress and keeps field names stable when showing errors. |

## Verification limits

The layout regression exercises the media-query mode transitions in a simulated DOM. The Xydrive smoke checks use synthetic data. Neither simulates physical input, service permissions or Telegram authentication. Chromium could not start because the execution environment denied its local socket. There was no authenticated test session.

The pending rendered viewport matrix is 320×568, 360×640, 390×844, 430×932, 844×390, 950×450, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900 and 1920×1080. Boundary checks remain for 575/576, 600/601, 925/926 and 1275/1276 CSS pixels. Repeat these checks with zoom, safe areas, the virtual keyboard, RTL, reduced motion and light, dark and custom themes.
