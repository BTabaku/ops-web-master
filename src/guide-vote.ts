import { chromium, type Browser, type BrowserContext, type Frame, type Locator } from "@playwright/test";
import { DEFAULT_ANSWER, DEFAULT_POLL_URL, knownAnswers } from "./poll-config";
import { answerIdSelector, answerSelector } from "./selector";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─────────────────────────────────────────────────────────────────────────────
// Single-instance guard
// ─────────────────────────────────────────────────────────────────────────────
const LOCK_FILE = join(tmpdir(), "poll-voter.pid");
if (existsSync(LOCK_FILE)) {
  const oldPid = parseInt(readFileSync(LOCK_FILE, "utf8").trim(), 10);
  if (!isNaN(oldPid) && oldPid !== process.pid) {
    try {
      process.kill(oldPid, "SIGTERM");
      process.stdout.write(`\x1b[33mKilled previous instance (PID ${oldPid}).\x1b[0m\n`);
      await new Promise<void>((r) => setTimeout(r, 800));
    } catch { /* already gone */ }
  }
}
writeFileSync(LOCK_FILE, String(process.pid));
function removeLock() { try { unlinkSync(LOCK_FILE); } catch { /**/ } }
process.on("exit",    removeLock);
process.on("SIGTERM", () => { removeLock(); process.exit(0); });

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const [rawKey, inlineVal] = token.slice(2).split("=", 2);
  const nextVal = process.argv[i + 1];
  const value = inlineVal ?? (nextVal && !nextVal.startsWith("--") ? process.argv[++i] : "true");
  args.set(rawKey, value);
}

const targetUrl      = args.get("url")             ?? DEFAULT_POLL_URL;
const targetAnswer   = args.get("answer")          ?? DEFAULT_ANSWER;
const intervalMs     = Math.max(Number(args.get("refresh-seconds")   ?? 3), 1) * 1_000;
// Visible by default — pass --headless true to run hidden
const headless       = args.get("headless") === "true";
const minConcurrency = Math.max(Number(args.get("min-concurrency") ?? args.get("concurrency") ?? 3), 1);
const maxConcurrency = Math.max(Number(args.get("max-concurrency") ?? args.get("concurrency") ?? 5), minConcurrency);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSI logger
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",  bold:  "\x1b[1m",  dim:    "\x1b[2m",
  green:  "\x1b[32m", red:   "\x1b[31m", yellow: "\x1b[33m",
  cyan:   "\x1b[36m", white: "\x1b[97m",
} as const;
const o = (s: string) => process.stdout.write(s);
const e = (s: string) => process.stderr.write(s);
const ts = () => `${C.dim}${new Date().toLocaleTimeString("en-GB")}${C.reset}`;

function printHeader() {
  const W = 64;
  const hr = "\u2500".repeat(W);
  const row = (label: string, val: string) => {
    const visibleVal = val.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = W - 1 - 1 - label.padEnd(12).length - 1 - visibleVal.length;
    o(`\u2502 ${C.dim}${label.padEnd(12)}${C.reset} ${val}${" ".repeat(Math.max(pad, 0))}\u2502\n`);
  };
  o(`\n\u250c${hr}\u2510\n`);
  o(`\u2502  ${C.bold}${C.white}POLL VOTER${C.reset}${" ".repeat(W - 12)}\u2502\n`);
  o(`\u251c${hr}\u2524\n`);
  row("Target",      `${C.cyan}${C.bold}${targetAnswer}${C.reset}`);
  row("URL",         `${C.dim}${targetUrl}${C.reset}`);
  row("Interval",    `${C.yellow}${intervalMs / 1_000} s${C.reset} \u00b1 1 s jitter`);
  row("Batch/round", `${C.yellow}${minConcurrency}\u2013${maxConcurrency}${C.reset} (random)`);
  row("Browser",     headless ? `${C.dim}headless${C.reset}` : `${C.green}visible${C.reset}`);
  o(`\u2514${hr}\u2518\n`);
  o(`${C.dim}Press Ctrl+C to stop.${C.reset}\n\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Selector
// ─────────────────────────────────────────────────────────────────────────────
const knownAnswer = knownAnswers.find(
  (a) => a.label.toLowerCase() === targetAnswer.toLowerCase()
);
const voteSelector = knownAnswer
  ? answerIdSelector(knownAnswer.answerId, knownAnswer.label)
  : answerSelector(targetAnswer);

// ─────────────────────────────────────────────────────────────────────────────
// Overlay dismissal
// ─────────────────────────────────────────────────────────────────────────────
const WP_COOKIE_SELS = [
  '#eu-cookie-law input.accept[value="Close and accept"]',
  '#eu-cookie-law input.accept[type="submit"]',
  '#eu-cookie-law form input.accept',
  'input[value="Close and accept"]',
];
const CONSENT_NAMES = [
  /^close and accept$/i, /^accept$/i, /^accept all$/i, /^agree$/i,
  /^i agree$/i, /^i accept$/i, /^allow all$/i, /^continue$/i,
  /^got it$/i, /^ok$/i, /^okay$/i, /^close$/i, /^dismiss$/i,
];

async function tryClick(loc: Locator, force = false): Promise<boolean> {
  const n = await loc.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const item = loc.nth(i);
    const ready = await item.isVisible()
      .then(async (v) => v && await item.isEnabled())
      .catch(() => false);
    if (!ready) continue;
    try { await item.click({ force, timeout: 1_500 }); return true; }
    catch { /* next */ }
  }
  return false;
}

async function dismissOverlays(frame: Frame): Promise<void> {
  for (const sel of WP_COOKIE_SELS) {
    if (await tryClick(frame.locator(sel), true)) {
      await frame.page().waitForTimeout(400);
      return;
    }
  }
  await frame.locator("#eu-cookie-law").evaluate((el) => {
    const btn = el.querySelector<HTMLInputElement>(
      'input.accept[type="submit"], input[value="Close and accept"]'
    );
    if (btn) btn.click();
  }).catch(() => undefined);
  for (const name of CONSENT_NAMES) {
    if (await tryClick(frame.getByRole("button", { name }))) await frame.page().waitForTimeout(300);
    if (await tryClick(frame.getByRole("link",   { name }))) await frame.page().waitForTimeout(300);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Find the vote button (main frame → iframes)
// Short timeouts — we retry the whole page load on failure rather than waiting.
// ─────────────────────────────────────────────────────────────────────────────
async function findVoteButton(page: import("@playwright/test").Page): Promise<Locator | null> {
  // 1. Main frame — 10 s is plenty; retry handles the rare slow load
  const mainLoc = page.locator(voteSelector);
  try {
    await mainLoc.first().waitFor({ state: "visible", timeout: 10_000 });
    return mainLoc.first();
  } catch { /* fall through */ }

  // 2. Explicit iframe scan
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    const loc = f.locator(voteSelector);
    if (await loc.count().catch(() => 0) > 0 &&
        await loc.first().isVisible().catch(() => false)) return loc.first();
  }

  // 3. frameLocator wildcard
  const iframeLoc = page.frameLocator("iframe").locator(voteSelector);
  try {
    await iframeLoc.first().waitFor({ state: "visible", timeout: 5_000 });
    return iframeLoc.first();
  } catch { /* fall through */ }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser (single shared instance — many fresh contexts, one cookie jar each)
// ─────────────────────────────────────────────────────────────────────────────
const browser: Browser = await chromium.launch({
  headless,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ],
});

let totalVotes  = 0;
let totalErrors = 0;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Cast one vote — retries the page load up to MAX_RETRIES times on any failure
// so a slow/blank page load doesn't permanently count as an error.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_RETRIES = 2;

async function castOneVote(attemptNumber: number): Promise<boolean> {
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: USER_AGENTS[attemptNumber % USER_AGENTS.length],
      locale: "en-US",
      timezoneId: "Europe/Tirane",
      storageState: { cookies: [], origins: [] },
    });

    const page = await context.newPage();

    // Remove automation fingerprint
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Navigate — domcontentloaded is fast; findVoteButton waits for widget
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

      // Dismiss any overlays
      for (const frame of page.frames()) await dismissOverlays(frame);

      // Find the button
      const btn = await findVoteButton(page);

      if (!btn) {
        if (attempt < MAX_RETRIES) {
          e(`${C.yellow}  ↺ [#${attemptNumber}] Button not found, retrying (${attempt + 1}/${MAX_RETRIES})…${C.reset}\n`);
          continue;  // reload and try again
        }
        throw new Error(`Button for "${targetAnswer}" not found after ${MAX_RETRIES + 1} attempts`);
      }

      // Set up the response listener BEFORE clicking so we don't miss it
      const voteApiDone = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          /crowdsignal|polldaddy|polls\.fm/i.test(r.url()),
        { timeout: 15_000 }
      )
        .then((r) => r.status() < 400)
        .catch(() => null);   // null = no matching response seen (fallback path)

      // Scroll into view and click
      await btn.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
      await btn.click({ timeout: 5_000 });

      // Wait for the POST to complete (confirms vote was received by server)
      const apiConfirmed = await voteApiDone;

      if (apiConfirmed === null) {
        // Crowdsignal API call not detected — look for DOM change (results appear)
        const domConfirmed = await page
          .locator([
            ".crowdsignal-forms-poll__results",
            ".crowdsignal-forms-poll__feedback",
            ".crowdsignal-forms__success",
            ".crowdsignal-forms-poll__answer.is-selected",
          ].join(", "))
          .first()
          .isVisible({ timeout: 5_000 })
          .catch(() => false);

        if (!domConfirmed) {
          // Final fallback: give it 3 s and trust the click happened
          await page.waitForTimeout(3_000);
        }
      }

      return true;  // vote cast successfully
    }

    return false;  // exhausted retries without throwing
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    e(`${C.red}  ✗ [#${attemptNumber}] ${msg.split("\n")[0].slice(0, 120)}${C.reset}\n`);
    return false;
  } finally {
    await context?.close().catch(() => undefined);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────────
printHeader();

const startTime = Date.now();

process.on("SIGINT", async () => {
  const elapsedMin = (Date.now() - startTime) / 60_000;
  const rate = elapsedMin > 0.01 ? (totalVotes / elapsedMin).toFixed(1) : "\u2014";
  o(
    `\n${C.bold}Stopped.${C.reset}` +
    `  Total: ${C.green}${C.bold}${totalVotes} votes${C.reset}` +
    `  Errors: ${totalErrors > 0 ? C.red : C.dim}${totalErrors}${C.reset}` +
    `  Elapsed: ${elapsedMin.toFixed(1)} min` +
    `  Rate: ${C.yellow}${rate} v/min${C.reset}\n`
  );
  await browser.close().catch(() => undefined);
  process.exit(0);
});

let attempt = 0;

while (true) {
  const roundSize = randInt(minConcurrency, maxConcurrency);
  const batch = Array.from({ length: roundSize }, () => castOneVote(++attempt));
  const results = await Promise.all(batch);

  const successes = results.filter(Boolean).length;
  const failures  = results.length - successes;
  totalVotes  += successes;
  totalErrors += failures;

  const elapsedMin = (Date.now() - startTime) / 60_000;
  const rate = elapsedMin > 0.01 ? (totalVotes / elapsedMin).toFixed(1) : "\u2014";

  o(
    `${ts()}  ` +
    `${C.cyan}\u00d7${roundSize}${C.reset}  ` +
    `${C.green}+${String(successes).padStart(2)}${C.reset}` +
    (failures > 0 ? `  ${C.red}\u2717${failures}${C.reset}` : "     ") +
    `  total ${C.bold}${C.white}${String(totalVotes).padStart(4)}${C.reset}` +
    `  ${C.dim}${rate} v/min${C.reset}\n`
  );

  const jitter = (Math.random() * 2 - 1) * 1_000;
  await new Promise<void>((r) => setTimeout(r, Math.max(intervalMs + jitter, 1_000)));
}
