# 🤖 WaveBot — Sprint-in-a-Box

> Your automated referee for the **Fix, Merge, Earn** cycle.

<!-- WAVE_STATUS_START -->
> 🌊 **Wave Active** — Last updated: 2026-05-09
<!-- WAVE_STATUS_END -->

---

## Table of Contents

- [What Is WaveBot?](#what-is-wavebot)
- [The Problem It Solves](#the-problem-it-solves)
- [Wave Lifecycle](#wave-lifecycle)
- [Features](#features)
- [How Points Work](#how-points-work)
- [Architecture](#architecture)
- [Code Snippets](#code-snippets)
  - [extract-points.js](#extract-pointsjs)
  - [tally-summary.js](#tally-summaryjs)
  - [wave-bot.yml — Full Workflow](#wave-botyml--full-workflow)
- [Installation](#installation)
- [Manual Triggers](#manual-triggers)
- [SUMMARY.md Output](#summarymd-output)
- [Permissions Required](#permissions-required)
- [FAQ](#faq)

---

## What Is WaveBot?

WaveBot is a **zero-dependency GitHub Actions automation bot** that manages the full lifecycle of a **Drips Wave** — a 7-day open-source sprint where contributors earn points by merging pull requests.

It acts as the invisible referee of your sprint. From the moment a Wave opens to the moment the Treasury processes payouts, WaveBot handles every mechanical step: announcing the wave, scoring merges, posting feedback to contributors, locking down labels at cycle end, and generating the final leaderboard.

WaveBot is entirely self-contained inside your repository. It requires no external services, no databases, no API keys beyond the built-in `GITHUB_TOKEN`, and no npm packages. Drop two scripts and one workflow file into your repo and it's live.

---

## The Problem It Solves

Running a Drips Wave manually means a maintainer must:

- Monitor every PR merge throughout the day
- Look up the PR's labels to determine the point value
- Post a comment on the PR confirming the points
- Keep a running tally of every contributor's score
- Update the README status block daily so contributors know the wave is active
- At cycle end, manually remove `Wave` labels from every open issue
- Compile a final `SUMMARY.md` for the Treasury to process

For a wave with 20–50 contributors, this is hours of repetitive work per day. Miss a merge and a contributor loses their points. Forget to lock down labels and contributors keep submitting after the wave closes. WaveBot eliminates every one of these failure points.

---

## Wave Lifecycle

A Wave moves through three distinct phases. WaveBot automates the transitions between them.

```
  DAY 1                    DAY 7                   POST-WAVE
    │                        │                         │
    ▼                        ▼                         ▼
┌─────────┐            ┌──────────┐            ┌─────────────┐
│  OPEN   │──────────▶ │  ACTIVE  │──────────▶ │   CLOSED    │
│         │            │          │            │             │
│ Issues  │            │ PRs are  │            │ Labels      │
│ tagged  │            │ merged & │            │ stripped.   │
│ `Wave`  │            │ scored   │            │ SUMMARY.md  │
│         │            │ daily    │            │ committed.  │
└─────────┘            └──────────┘            └─────────────┘
```

| Phase | Trigger | WaveBot Action |
|---|---|---|
| **Open** | Maintainer adds `Wave` label to issues | No action — issues are now eligible |
| **Active** | A PR with a point label is merged | Score it, comment on PR, update tally |
| **Active** | Daily cron fires at midnight UTC | Update README wave status block |
| **Closed** | Maintainer runs `lockdown` dispatch | Strip `Wave` labels, post closing comments, finalize `SUMMARY.md` |

---

## Features

### Automated Announcements

Every 24 hours at midnight UTC, WaveBot rewrites the `WAVE_STATUS` block in your `README.md` with the current date. This gives contributors a live signal that the wave is still running and the bot is healthy. The commit is tagged `[skip ci]` to avoid triggering other workflows.

### Real-Time Point Comments

The moment a PR is merged, WaveBot reads its labels, extracts the highest point value, and posts a comment directly on the PR:

> 🎉 Success! **50 Points** have been added to your Wave Profile.

Contributors get instant confirmation. No waiting, no guessing.

### Point Lockdown

When you trigger `lockdown`, WaveBot iterates over every open issue carrying the `Wave` label and:
1. Removes the `Wave` label so the issue no longer appears in wave queries
2. Posts a comment: _"🔒 Wave cycle has ended. Points are now locked."_

This prevents late submissions and clearly signals to contributors that the sprint is over.

### Tally Generation

After every merge (and on-demand via `tally` dispatch), WaveBot queries the GitHub API for all merged PRs, aggregates points per contributor, sorts the leaderboard by score descending, and commits a fresh `SUMMARY.md` to the repository. The file is immediately ready for Treasury processing.

### Manual Override

Every phase of the wave can be triggered manually from the GitHub Actions UI. This is useful for re-running a tally after a label correction, re-announcing mid-wave, or triggering lockdown early.

---

## How Points Work

Before merging a PR, apply exactly one point label. WaveBot reads all labels on the PR at merge time and awards the **highest** value found. This means if a PR is accidentally double-labelled, the contributor always gets the benefit of the doubt.

| Label | Points |
|---|---|
| `10-points` | 10 |
| `25-points` | 25 |
| `50-points` | 50 |
| `100-points` | 100 |

**Rules:**
- If no point label is present, the PR is silently skipped — no comment, no tally entry.
- If multiple point labels are present, only the highest is counted.
- Points are per-PR, not per-commit. One merge = one score event.
- The tally is cumulative. A contributor who merges three `50-points` PRs earns 150 total.

---

## Architecture

WaveBot is driven by three GitHub Actions event triggers, each mapped to a distinct job inside a single workflow file.

### Trigger Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                            TRIGGERS                                 │
├──────────────────────┬──────────────────┬───────────────────────────┤
│   pull_request       │    schedule      │     workflow_dispatch     │
│   types: [closed]    │  cron: 0 0 * * * │     (manual input)        │
│   merged == true     │  (daily, UTC)    │                           │
└──────────┬───────────┴────────┬─────────┴────────────┬──────────────┘
           │                    │                       │
           ▼                    ▼                       ▼
   ┌───────────────┐   ┌────────────────┐   ┌──────────────────────────┐
   │ tally_points  │   │ daily_announce │   │   workflow_dispatch job  │
   │               │   │                │   │                          │
   │ 1. Checkout   │   │ 1. Checkout    │   │  input == 'announce'     │
   │ 2. Run        │   │ 2. Rewrite     │   │  → rewrite README block  │
   │    extract-   │   │    WAVE_STATUS │   │                          │
   │    points.js  │   │    block in    │   │  input == 'lockdown'     │
   │ 3. If points  │   │    README.md   │   │  → strip Wave labels     │
   │    != 0:      │   │ 3. Commit &    │   │  → post closing comments │
   │    post PR    │   │    push        │   │                          │
   │    comment    │   └────────────────┘   │  input == 'tally'        │
   │ 4. Run        │                        │  → run tally-summary.js  │
   │    tally-     │                        │  → commit SUMMARY.md     │
   │    summary.js │                        └──────────────────────────┘
   │ 5. Commit &   │
   │    push       │
   │    SUMMARY.md │
   └───────────────┘
```

### Data Flow

```
GitHub PR merged
       │
       ▼
wave-bot.yml (tally_points job)
       │
       ├─▶ extract-points.js
       │         │
       │         │  reads: github.event.pull_request.labels (JSON)
       │         │  logic: find highest POINT_LABELS match
       │         │  output: integer written to stdout
       │         ▼
       │   $GITHUB_OUTPUT: points=50
       │
       ├─▶ actions/github-script (if points != 0)
       │         │
       │         │  calls: github.rest.issues.createComment
       │         │  posts: "🎉 50 Points added to your Wave Profile"
       │         ▼
       │   PR comment created
       │
       └─▶ tally-summary.js
                 │
                 │  calls: GET /repos/:owner/:repo/pulls?state=closed
                 │  filters: merged_at != null && point label present
                 │  aggregates: points per contributor
                 │  sorts: descending by total points
                 │  writes: SUMMARY.md
                 ▼
           git commit + push → SUMMARY.md updated in repo
```

### File Map

```
your-repo/
├── .github/
│   ├── workflows/
│   │   └── wave-bot.yml          # Single workflow file — all three jobs
│   └── scripts/
│       ├── extract-points.js     # Reads PR labels → outputs point integer
│       └── tally-summary.js      # Queries API → writes ranked SUMMARY.md
├── README.md                     # Contains WAVE_STATUS_START/END block
└── SUMMARY.md                    # Auto-generated, committed by WaveBot
```

### Why a Single Workflow File?

All three jobs live in `wave-bot.yml` rather than separate files. This keeps the entire bot auditable in one place — one file to review, one file to copy during installation, one file to update when the point scale changes. The jobs are conditionally gated by `github.event_name` and `github.event.inputs.action` so they never interfere with each other.

---

## Code Snippets

### extract-points.js

This script is the scoring engine. It is called by the workflow on every merged PR, receives the PR's label array as a JSON string via `process.argv[2]`, and writes the highest matching point value to stdout.

```js
// .github/scripts/extract-points.js
const POINT_LABELS = {
  '10-points':  10,
  '25-points':  25,
  '50-points':  50,
  '100-points': 100,
};

// Labels arrive as a JSON array of either strings or GitHub label objects.
const labels = JSON.parse(process.argv[2] || '[]');
const names  = labels.map(l => (typeof l === 'string' ? l : l.name));

// Take the highest value. Returns 0 if no point label is found.
const points = names.reduce(
  (max, name) => Math.max(max, POINT_LABELS[name] ?? 0),
  0
);

process.stdout.write(String(points));
```

**Why `Math.max` instead of summing?**
The Wave rules award one score per PR, not one score per label. Using `Math.max` means a PR labelled both `25-points` and `50-points` earns 50, not 75. This prevents accidental double-scoring from label mistakes.

**Why `process.stdout.write` instead of `console.log`?**
`console.log` appends a newline. The workflow captures the output with `$(...)` and assigns it to a shell variable. A trailing newline would be harmless in most shells, but `process.stdout.write` is explicit and clean.

---

### tally-summary.js

This script queries the GitHub REST API for all closed PRs, filters to those that were merged and carry a point label, aggregates scores per contributor, and writes the ranked leaderboard to `SUMMARY.md`.

```js
// .github/scripts/tally-summary.js
const https = require('https');
const fs    = require('fs');

const POINT_LABELS = { '10-points': 10, '25-points': 25, '50-points': 50, '100-points': 100 };
const [owner, repo] = (process.env.REPO || '').split('/');
const token = process.env.GITHUB_TOKEN;

// Minimal HTTPS GET wrapper — no npm dependencies required.
function get(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'WaveBot',
        'Authorization': `token ${token}`,
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Fetch up to 100 closed PRs. For larger waves, add pagination.
  const prs = await get(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100`);

  const tally = {};

  for (const pr of prs) {
    if (!pr.merged_at) continue; // Skip closed-but-not-merged PRs

    // Sum all point labels on this PR (or take max — adjust to your rules)
    const points = pr.labels.reduce((sum, l) => sum + (POINT_LABELS[l.name] ?? 0), 0);
    if (!points) continue; // Skip PRs with no point labels

    tally[pr.user.login] = (tally[pr.user.login] || 0) + points;
  }

  // Sort contributors by total points, highest first
  const rows = Object.entries(tally)
    .sort(([, a], [, b]) => b - a)
    .map(([user, pts]) => `| @${user} | ${pts} |`)
    .join('\n');

  const date = new Date().toISOString().split('T')[0];
  const content = `# Wave Tally — ${date}\n\n| Contributor | Points |\n|---|---|\n${rows || '| — | — |'}\n`;

  fs.writeFileSync('SUMMARY.md', content);
  console.log('SUMMARY.md written.');
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Note:** `tally-summary.js` uses `reduce` with a sum (not `Math.max`) because it is aggregating across multiple PRs per contributor. Each PR's individual score is already the correct value (set by `extract-points.js` at merge time). The tally just adds them up.

---

### wave-bot.yml — Full Workflow

The complete workflow file. All three jobs are gated by their respective trigger conditions.

```yaml
name: Drips Wave Monitor

on:
  # Fires on every PR close event. The job itself checks merged == true.
  pull_request:
    types: [closed]

  # Daily announcement at midnight UTC.
  schedule:
    - cron: '0 0 * * *'

  # Manual override for announce, lockdown, and tally.
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to run: announce | lockdown | tally'
        required: true
        default: 'announce'

jobs:

  # ─────────────────────────────────────────────
  # JOB 1: Score a merged PR and update the tally
  # ─────────────────────────────────────────────
  tally_points:
    name: Tally Points on Merge
    if: github.event_name == 'pull_request' && github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Extract points from PR labels
        id: points
        run: |
          POINTS=$(node .github/scripts/extract-points.js '${{ toJson(github.event.pull_request.labels) }}')
          echo "points=$POINTS" >> $GITHUB_OUTPUT

      - name: Comment on merged PR
        if: steps.points.outputs.points != '0'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `🎉 Success! **${{ steps.points.outputs.points }} Points** have been added to your Wave Profile.`
            });

      - name: Generate tally summary
        run: node .github/scripts/tally-summary.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPO: ${{ github.repository }}

      - name: Commit SUMMARY.md
        run: |
          git config user.name "WaveBot"
          git config user.email "wavebot@users.noreply.github.com"
          git add SUMMARY.md
          git diff --cached --quiet || git commit -m "chore: update wave tally [skip ci]"
          git push

  # ─────────────────────────────────────────────
  # JOB 2: Daily README status update
  # ─────────────────────────────────────────────
  daily_announce:
    name: Daily Wave Status Announcement
    if: >
      github.event_name == 'schedule' ||
      (github.event_name == 'workflow_dispatch' && github.event.inputs.action == 'announce')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Update README wave status block
        uses: actions/github-script@v7
        with:
          script: |
            const fs   = require('fs');
            const now  = new Date().toISOString().split('T')[0];
            let readme = fs.readFileSync('README.md', 'utf8');
            readme = readme.replace(
              /<!-- WAVE_STATUS_START -->[\s\S]*?<!-- WAVE_STATUS_END -->/,
              `<!-- WAVE_STATUS_START -->\n> 🌊 **Wave Active** — Last updated: ${now}\n<!-- WAVE_STATUS_END -->`
            );
            fs.writeFileSync('README.md', readme);

      - name: Commit README update
        run: |
          git config user.name "WaveBot"
          git config user.email "wavebot@users.noreply.github.com"
          git add README.md
          git diff --cached --quiet || git commit -m "chore: daily wave status update [skip ci]"
          git push

  # ─────────────────────────────────────────────
  # JOB 3: Lockdown — end the wave cycle
  # ─────────────────────────────────────────────
  lockdown:
    name: Lock Wave Labels at Cycle End
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.action == 'lockdown'
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/checkout@v4

      - name: Remove Wave labels and post closing comments
        uses: actions/github-script@v7
        with:
          script: |
            const { data: issues } = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo:  context.repo.repo,
              labels: 'Wave',
              state:  'open',
              per_page: 100
            });

            for (const issue of issues) {
              // Remove the Wave label
              await github.rest.issues.removeLabel({
                owner:        context.repo.owner,
                repo:         context.repo.repo,
                issue_number: issue.number,
                name:         'Wave'
              }).catch(() => {}); // Ignore if label already removed

              // Post a closing comment
              await github.rest.issues.createComment({
                owner:        context.repo.owner,
                repo:         context.repo.repo,
                issue_number: issue.number,
                body:         '🔒 Wave cycle has ended. Points are now locked. Thank you for participating!'
              });
            }
```

---

## Installation

### Step 1 — Copy the files

```bash
# From your repository root
mkdir -p .github/workflows .github/scripts

# Copy the three bot files into place
cp wave-bot.yml        .github/workflows/wave-bot.yml
cp extract-points.js   .github/scripts/extract-points.js
cp tally-summary.js    .github/scripts/tally-summary.js
```

### Step 2 — Add the WAVE_STATUS block to your README

Paste this block anywhere in your `README.md`. WaveBot will rewrite the content between the comment tags every day.

```md
<!-- WAVE_STATUS_START -->
> 🌊 **Wave Active** — Last updated: 2026-05-09
<!-- WAVE_STATUS_END -->
```

### Step 3 — Create labels

Go to **Settings → Labels** in your repository and create:

| Label | Color (suggested) |
|---|---|
| `Wave` | `#0075ca` (blue) |
| `10-points` | `#e4e669` (yellow) |
| `25-points` | `#f9d0c4` (peach) |
| `50-points` | `#d93f0b` (orange) |
| `100-points` | `#b60205` (red) |

### Step 4 — Enable write permissions

Go to **Settings → Actions → General → Workflow permissions** and select **Read and write permissions**. This allows WaveBot to commit `README.md` and `SUMMARY.md` back to the repository.

### Step 5 — Push and verify

Push the files to your default branch. Open a test PR, add a `50-points` label, and merge it. Within seconds you should see:
- A comment on the PR: _"🎉 Success! 50 Points have been added to your Wave Profile."_
- A new commit updating `SUMMARY.md`

---

## Manual Triggers

Go to **Actions → Drips Wave Monitor → Run workflow** and select an action from the dropdown:

| Input | When to Use | What Happens |
|---|---|---|
| `announce` | Any time during the wave | Rewrites the README `WAVE_STATUS` block with today's date |
| `lockdown` | End of the 7-day cycle | Strips `Wave` labels from all open issues, posts a closing comment on each |
| `tally` | After correcting a label | Re-runs `tally-summary.js` and commits a fresh `SUMMARY.md` |

---

## SUMMARY.md Output

After every merge and at wave end, `SUMMARY.md` is committed to the repository root. It looks like this:

```md
# Wave Tally — 2026-05-09

| Contributor | Points |
|---|---|
| @alice | 150 |
| @bob | 100 |
| @carol | 75 |
| @dave | 50 |
| @eve | 25 |
```

The file is sorted by total points descending and is ready for Treasury processing without any manual editing.

---

## Permissions Required

WaveBot declares its permissions explicitly in each job using the `permissions:` key. No job requests more than it needs.

| Job | Permission | Why |
|---|---|---|
| `tally_points` | `contents: write` | Commit `SUMMARY.md` |
| `tally_points` | `pull-requests: write` | Post point comment on merged PR |
| `tally_points` | `issues: write` | Required by `github-script` for issue comments |
| `daily_announce` | `contents: write` | Commit `README.md` |
| `lockdown` | `issues: write` | Remove labels and post comments on issues |

The built-in `GITHUB_TOKEN` is used for all API calls. No personal access tokens or secrets are required.

---

## FAQ

**What happens if a PR is merged without a point label?**
WaveBot detects that `extract-points.js` returned `0` and skips both the comment and the tally update. The PR is ignored silently.

**Can I change the point values?**
Yes. Edit the `POINT_LABELS` object in `extract-points.js` and `tally-summary.js`. Both files define it at the top. Keep the label names in sync with your GitHub labels.

**What if two contributors open PRs for the same issue?**
Both PRs are scored independently. WaveBot does not deduplicate by issue — it scores by PR merge. If you want to prevent this, close duplicate PRs before merging.

**Can I run multiple waves in the same repo?**
Not simultaneously with the current setup. The tally queries all closed PRs without a date filter. To scope a wave to a date range, add a `since` parameter to the `tally-summary.js` API call.

**Does WaveBot work on private repositories?**
Yes. The `GITHUB_TOKEN` has access to the repository it runs in, regardless of visibility.
