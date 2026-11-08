import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const env = { ...process.env, GITHUB_PAGES: 'true' };
const url = env.BELILOG_URL ?? 'http://127.0.0.1:5175/FinanceControl/';
const server = env.BELILOG_URL ? null : spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5175', '--strictPort'],
  { env, stdio: 'inherit' });
async function run(file) {
  const child = spawn(process.execPath, [file], { env: { ...env, BELILOG_URL: url }, stdio: 'inherit' });
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (result !== 0) throw new Error(`${file} failed (${result})`);
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error('Preview server exited');
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* wait for preview */ }
    await delay(200);
  }
  if (!ready) throw new Error(`Preview did not start: ${url}`);
  await run('tests/browser-regressions.mjs');
  await run('tests/persistence-browser.mjs');
  await run('tests/shopping-confirmation.mjs');
  await run('tests/performance-regressions.mjs');
  await run('tests/planning-browser.mjs');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server?.kill('SIGTERM');
}
