# Organization and storage alpha

A native worker validates the current account, the original file identity and owner-controlled private channels. Delete is permanent and requires explicit UI confirmation. Move forwards the file, verifies the returned destination message and media ID, and only then attempts source deletion. Ambiguous outcomes preserve the source whenever deletion has not begun and require manual review. No protected media is copied. Do not automatically retry uncertain operations.

Folder hierarchy, display aliases, favorites, pins and last-opened timestamps are account-scoped browser settings, not Telegram cloud metadata. Private channels remain the actual backing storage; hierarchy is a logical parent map. Original Telegram filenames and download names do not change. The overview scans Saved Messages and mounted channels sequentially; it is bounded and reports partial results, not unlimited or continuous sync. Indexed results are in tab memory. Known sizes are logical file totals, not Telegram quota or physical usage. No server database or file proxy is added.

Test on disposable channels/files before deleting or moving real data. Unit tests added for organization; production build and authenticated tests are pending.
