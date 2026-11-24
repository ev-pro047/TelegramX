import { spawnSync } from 'node:child_process';

const { TELEGRAM_API_ID, TELEGRAM_API_HASH, BASE_URL } = process.env;
if (!/^[1-9]\d*$/.test(TELEGRAM_API_ID || '') || !/^[a-fA-F0-9]{32}$/.test(TELEGRAM_API_HASH || '')) {
  console.error('Set valid TELEGRAM_API_ID and TELEGRAM_API_HASH in Heroku Config Vars.');
  process.exit(1);
}
let url;
try {
  url = new URL(BASE_URL || '');
} catch {
  console.error('Set BASE_URL to your HTTPS Heroku app root URL.');
  process.exit(1);
}
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  console.error('BASE_URL must be an HTTPS root URL.');
  process.exit(1);
}
const build = spawnSync('npm', ['run', 'build:production'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BASE_URL: url.href,
    APP_NAME: process.env.APP_NAME || 'TelegramX',
    APP_TITLE: process.env.APP_TITLE || 'TelegramX',
  },
});
process.exit(build.status ?? 1);
