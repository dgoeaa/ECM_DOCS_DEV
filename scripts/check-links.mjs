#!/usr/bin/env node
/**
 * Link / asset checker for DGO Targets.
 *
 * Starts http-server, then runs linkinator against both apps to verify
 * same-origin links resolve. External CDN hosts are skipped so the check
 * remains reliable offline / in CI.
 *
 * Usage:  node scripts/check-links.mjs
 */

import { execSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8081; // separate port so it does not conflict with the test server

const SKIP_PATTERNS = [
  'fonts\\.googleapis\\.com',
  'fonts\\.gstatic\\.com',
  'cdn\\.tailwindcss\\.com',
  'unpkg\\.com',
  'powerplatform\\.com',
  'powerautomate\\.com',
  'kanihamza\\.workers\\.dev',
  'localhost:\\d+/config/config\\.local\\.js$',
  'localhost:\\d+/ECM_ActivityHub_Portal/config\\.local\\.js$',
];

async function main() {
  // Start the static server
  const server = spawn(
    'npx',
    ['http-server', '.', '-p', String(PORT), '--cors', '-c-1', '--silent'],
    { stdio: 'inherit' }
  );

  // Give the server a moment to start
  await sleep(2000);

  let exitCode = 0;
  try {
    const skipArg = SKIP_PATTERNS.join('|');
    const urls = [
      `http://localhost:${PORT}/index.html`,
      `http://localhost:${PORT}/ECM_ActivityHub_Portal/index.html`,
    ];

    for (const url of urls) {
      console.log(`\nChecking links in: ${url}`);
      try {
        execSync(
          `npx linkinator "${url}" --skip "${skipArg}" --format text --timeout 10000`,
          // Hard ceiling per entry point. Without it a recursive crawl that reaches an
          // unreachable host can hang indefinitely and stall CI rather than fail it.
          { stdio: 'inherit', timeout: 120_000 }
        );
      } catch (err) {
        if (err?.killed || err?.signal === 'SIGTERM') {
          console.error(`\n✗ Timed out after 120s crawling ${url}`);
        }
        exitCode = 1;
      }
    }
  } finally {
    server.kill();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
