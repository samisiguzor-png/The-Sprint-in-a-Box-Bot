#!/usr/bin/env node
// Fetches all merged PRs in the current wave window and writes SUMMARY.md.
// Requires: GITHUB_TOKEN and REPO env vars.

const https = require('https');
const fs = require('fs');

const POINT_LABELS = { '10-points': 10, '25-points': 25, '50-points': 50, '100-points': 100 };
const [owner, repo] = (process.env.REPO || '').split('/');
const token = process.env.GITHUB_TOKEN;

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'api.github.com', path, headers: { 'User-Agent': 'WaveBot', Authorization: `token ${token}` } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const prs = await get(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100`);
  const tally = {};

  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const points = pr.labels.reduce((sum, l) => sum + (POINT_LABELS[l.name] ?? 0), 0);
    if (!points) continue;
    tally[pr.user.login] = (tally[pr.user.login] || 0) + points;
  }

  const rows = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([user, pts]) => `| @${user} | ${pts} |`)
    .join('\n');

  const date = new Date().toISOString().split('T')[0];
  fs.writeFileSync('SUMMARY.md',
    `# Wave Tally — ${date}\n\n| Contributor | Points |\n|---|---|\n${rows || '| — | — |'}\n`
  );
  console.log('SUMMARY.md written.');
}

main().catch(e => { console.error(e); process.exit(1); });
