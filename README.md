# Poll Voter

Automated Playwright-based vote bot for Crowdsignal polls embedded in WordPress pages.  
Runs headless (or visible), fires multiple parallel votes per round, refreshes every few seconds, and **auto-clicks the target button** — no manual interaction needed.

## Quick start

```bash
npm install
npx playwright install chromium   # one-time browser install
npm run guide:david               # start voting for David
```

Output:
```
┌────────────────────────────────────────────────────────────────┐
│  POLL VOTER                                                      │
├────────────────────────────────────────────────────────────────┤
│ Target       David                                               │
│ URL          https://myfuturengo.wordpress.com/2026/05/11/871/  │
│ Interval     4 s ± 1 s jitter                                   │
│ Batch size   3–5 (random per round)                             │
│ Headless     yes                                                 │
└────────────────────────────────────────────────────────────────┘
Press Ctrl+C to stop.

00:16:01  ×4  +4   total    4  12.3 v/min
00:16:06  ×3  +3   total    7  13.1 v/min
```

## npm scripts

| Script | What it does |
|--------|-------------|
| `npm run guide:david` | Vote for David, headless, 3–5 parallel, every 4 s |
| `npm run guide:david:watch` | Same but opens a visible browser window |
| `npm run guide:david:fast` | 5–8 parallel votes per round |
| `npm run guide` | Fully custom via flags (see below) |

## CLI flags

```bash
npm run guide -- [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--answer "Name"` | `David` | Exact label of the poll option to vote for |
| `--url "https://..."` | WordPress poll URL | Poll page to open |
| `--refresh-seconds N` | `4` | Seconds between vote rounds |
| `--min-concurrency N` | `3` | Min parallel votes per round |
| `--max-concurrency N` | `5` | Max parallel votes per round |
| `--headless false` | `true` | Open a visible Chromium window |

Example — vote for Juli, 5–8 parallel, every 3 seconds, watch mode:

```bash
npm run guide -- --answer "David" --refresh-seconds 3 --min-concurrency 5 --max-concurrency 8 --headless false
```

### USE THIS
```bash
npm run guide -- --answer "David" --refresh-seconds 4 --min-concurrency 3 --max-concurrency 5
```

## Single-instance guard

Running `npm run guide:david` again **automatically kills the previous instance** before starting. A PID lockfile at `<tmpdir>/poll-voter.pid` tracks the running process. No need to manually Ctrl+C first.

## How it works

Each vote round:
1. Spawns N fresh browser contexts (new cookie jar each = fresh vote slot).
2. Navigates to the poll page and waits for the Crowdsignal widget to fully load (`networkidle`).
3. Dismisses WordPress cookie banners and GDPR overlays automatically.
4. Locates the target button by `value=` attribute (with `answerid=` as legacy fallback).
5. Scrolls it into view and clicks it.
6. Waits 1.5 s for the vote request to fire, then closes the context.

## Browser app (Vite UI)

A companion web UI lists all poll options and generates the correct CLI command for each:

```bash
npm run dev
```

Open the local URL printed in the terminal.

## Poll target

```text
https://myfuturengo.wordpress.com/2026/05/11/871/
```

Known answer IDs:

| Answer | ID |
|--------|----|
| Alvin | 74310880 |
| AMS | 74310889 |
| Baca | 74310891 |
| David | 74310892 |
| Juli | 74310893 |
| Koja | 74310900 |
| Luis | 74310901 |
| Santiliano | 74310902 |
| Sejgi | 74310916 |
| Simple M | 74310917 |
# ops-web-master
# ops-web-master
