# Heroku alpha deployment

Use the classic Heroku Node.js buildpack with the main branch. Set TELEGRAM_API_ID and TELEGRAM_API_HASH from your own Telegram application at https://my.telegram.org and BASE_URL to the actual HTTPS app root before deployment. APP_NAME and APP_TITLE optionally override the Web XY display name and page title. Set both to Web XY if the existing deployment still has the old branding. Rebuild after changes because Vite embeds these values. The proposed /xy/ path is not an official Telegram route; use your own HTTPS origin. The application credentials are visible in the browser bundle; do not add personal session strings, passwords, phone numbers, codes or bot tokens.

The Heroku build hook runs the production build; the web dyno serves dist only. Health check: /healthz. No database or external Telegram file proxy. A private GitHub repository does not make the web endpoint private.

Phone login is the native default on every platform; QR remains optional. Telegram controls login-code delivery and may request two-step verification. Keep the official Telegram app on the same phone to receive supported in-app codes. Do not share codes or passwords.

The full production build and authenticated transfers must still be tested.
