# 🤖 WaveBot — Sprint-in-a-Box

> Your automated referee for the **Fix, Merge, Earn** cycle.

<!-- WAVE_STATUS_START -->
> 🌊 **Wave Active** — Last updated: 2026-07-26
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
