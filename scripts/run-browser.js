import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { startFixture } from '../tests/helpers.js';
const fixture = await startFixture();
let exitCode = 1;
try {
  await mkdir('.cache', { recursive: true });
  await writeFile('.cache/browser-url.txt', fixture.base);
  const env = { ...process.env };
  if (!env.PLAYWRIGHT_CHANNEL && process.platform === 'win32') {
    try { await access('C:/Program Files/Google/Chrome/Application/chrome.exe'); env.PLAYWRIGHT_CHANNEL = 'chrome'; } catch { /* Use installed Playwright Chromium on other machines. */ }
  }
  const runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env });
  exitCode = await new Promise((resolve, reject) => { runner.on('error', reject); runner.on('exit', code => resolve(code ?? 1)); });
} finally { await fixture.close(); }
process.exitCode = exitCode;
