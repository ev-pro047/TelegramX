# Security and release review

Web XY is an unofficial experimental Telegram client. Do not use the proposed Telegram-hosted address as a live origin.

## Security boundaries

- Authenticated file actions use Telegram's native client infrastructure and are account-scoped.
- Saved Messages is the drive root; eligible private channels hold folder files. Optional cloud metadata sync is experimental.
- Browser bundles necessarily contain application API ID/hash values. Never embed a personal session, bot token, login code, password, signing key or private deployment secret.
- Production builds ignore TEST_SESSION and omit production source maps.
- Keep .env and generated dist/ outside version control. Preserve the GPL licence, upstream notices and source availability when distributing builds.

## Before public release

1. Scan full Git history, all refs, release artifacts and CI logs for secrets and personal information. Rotate exposed credentials where applicable; deleting files in a new commit does not erase history.
2. Run npm ci, npm test, npm run check:ts, npm run check:css and a production build with a non-account validation configuration.
3. Test login, account switching, Saved Messages, nested folders, uploads/downloads, cancellation, error/retry handling, native media, mobile layouts and account isolation on actual devices. Verify cloud metadata sync on two devices.
4. Review the live site's privacy, security headers, upstream licence obligations and current Telegram API terms before distribution.
5. Confirm that no personal data appears in screenshots or logs.

Report suspected issues privately to the repository maintainer without posting session details or other private information. This checklist is not a security certification. Full-history scanning and authenticated runtime validation remain outstanding.
