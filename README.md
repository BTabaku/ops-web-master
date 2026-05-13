# Poll Voter

Automated vote bot — opens a real browser, finds the David button, clicks it repeatedly.

---

## 1. Install (once)

```bash
npm install
npx playwright install chromium
```

## 2. Run

```bash
npm run vote
```

Browser window opens, voting starts immediately. Press **Ctrl+C** to stop.

---

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run vote` | Vote for David — visible browser, 3–5 parallel, every 3 s |
| `npm run vote:fast` | 5–8 parallel, every 2 s (~50 votes/min) |
| `npm run vote:headless` | Hidden browser (no window) |

## Custom options

```bash
npm run vote -- --answer "Juli"
npm run vote -- --answer "David" --refresh-seconds 2 --min-concurrency 5 --max-concurrency 8
npm run vote -- --headless true
```

| Flag | Default | Description |
|------|---------|-------------|
| `--answer` | `David` | Who to vote for |
| `--refresh-seconds` | `3` | Seconds between rounds |
| `--min-concurrency` | `3` | Min parallel votes per round |
| `--max-concurrency` | `5` | Max parallel votes per round |
| `--headless true` | visible | Hide the browser window |

---

## Reading the output

```
┌────────────────────────────────────────────────────────────────┐
│  POLL VOTER                                                     │
├────────────────────────────────────────────────────────────────┤
│ Target       David                                              │
│ Interval     3 s ± 1 s jitter                                  │
│ Batch/round  3–5 (random)                                      │
│ Browser      visible                                            │
└────────────────────────────────────────────────────────────────┘
Press Ctrl+C to stop.

01:09:55  ×4  + 4       total    4  14.2 v/min
01:09:59  ×3  + 3       total    7  15.1 v/min
↺ [#8] Button not found, retrying attempt 1/2...
01:10:04  ×5  + 5       total   12  18.3 v/min
```

- `×4` = 4 parallel votes fired this round
- `+4` = 4 votes confirmed (green)
- `✗1` = 1 error (red)
- `↺ retrying` = page loaded blank, reloading automatically (yellow)

---

## Poll answers

| Name | Answer ID |
|------|-----------|
| Alvin | 74310880 |
| AMS | 74310889 |
| Baca | 74310891 |
| **David** | **74310892** |
| Juli | 74310893 |
| Koja | 74310900 |
| Luis | 74310901 |
| Santiliano | 74310902 |
| Sejgi | 74310916 |
| Simple M | 74310917 |

**Poll URL:** `https://myfuturengo.wordpress.com/2026/05/11/871/`

