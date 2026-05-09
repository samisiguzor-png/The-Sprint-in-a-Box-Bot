#!/usr/bin/env node
// Parses PR labels and returns the highest point value found.
// Usage: node extract-points.js '<json-labels-array>'

const POINT_LABELS = {
  '10-points': 10,
  '25-points': 25,
  '50-points': 50,
  '100-points': 100,
};

const labels = JSON.parse(process.argv[2] || '[]');
const names = labels.map(l => (typeof l === 'string' ? l : l.name));
const points = names.reduce((max, name) => Math.max(max, POINT_LABELS[name] ?? 0), 0);

process.stdout.write(String(points));
