const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const routes = ['home->history', 'history->shifts', 'shifts->planned', 'planned->home'];
function median(values) {
  assert(values.length > 0);
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function readRun(file) {
  const text = fs.readFileSync(file, 'utf8');
  assert(!text.includes('TRANSITION_PROBE_ERROR'), `Failed run: ${file}`);
  const summaries = [...text.matchAll(/TRANSITION_PROBE_SUMMARY (\{[^\r\n]+\})/g)];
  assert.equal(summaries.length, 1, `Missing/duplicate success summary: ${file}`);
  const summary = JSON.parse(summaries[0][1]);
  assert.equal(summary.status, 'ok');
  assert.equal(summary.observer, 'native-onDraw-then-screenshot');
  const rows = [...text.matchAll(/TRANSITION_PROBE (\{[^\r\n]+\})/g)].map(m => JSON.parse(m[1]));
  assert.equal(rows.length, summary.repeats * routes.length);
  assert.equal(rows.length, summary.transitions);
  const seen = new Set();
  for (const row of rows) {
    assert.equal(row.observer, summary.observer);
    assert.equal(row.warmOnly, true);
    assert(routes.includes(row.route));
    assert(Number.isInteger(row.cycle) && row.cycle >= 1 && row.cycle <= summary.repeats);
    const key = `${row.cycle}:${row.route}`;
    assert(!seen.has(key));
    seen.add(key);
    for (const metric of ['drawMs', 'lowerMs', 'upperMs']) assert(Number.isFinite(row[metric]) && row[metric] > 0);
    assert(row.drawMs <= row.lowerMs && row.lowerMs <= row.upperMs);
    assert(row.matchRatio >= 0.97 && row.sourceRatio >= 0.97 && row.maskSamples >= 128);
    assert.equal(row.captureMs.length, row.screenshotCount);
    assert.equal(row.captureWindowsMs.length, row.screenshotCount);
  }
  return { file: path.basename(file), summary, rows };
}
const round = value => Math.round(value * 1000) / 1000;
function stats(rows) {
  const values = key => rows.map(row => row[key]);
  return {
    n: rows.length,
    drawMedianMs: round(median(values('drawMs'))),
    drawRangeMs: [Math.min(...values('drawMs')), Math.max(...values('drawMs'))],
    observationMedianMs: [round(median(values('lowerMs'))), round(median(values('upperMs')))],
    screenshotMedianCount: median(values('screenshotCount')),
  };
}

assert.equal(median([9, 1, 3]), 3);
assert.equal(median([9, 1, 3, 5]), 4);
if (process.argv.includes('--self-check')) {
  console.log('median self-check passed');
} else {
  const runs = { before: [], after: [] };
  for (let i = 2; i < process.argv.length; i += 2) {
    const side = process.argv[i].replace(/^--/, '');
    assert(Object.hasOwn(runs, side) && process.argv[i + 1], 'Use --before file --after file (repeatable)');
    runs[side].push(readRun(process.argv[i + 1]));
  }
  assert(runs.before.length && runs.after.length, 'Both before and after are required');
  const comparison = routes.map(route => {
    const before = stats(runs.before.flatMap(run => run.rows).filter(row => row.route === route));
    const after = stats(runs.after.flatMap(run => run.rows).filter(row => row.route === route));
    return {
      route, before, after,
      drawMedianReductionMs: round(before.drawMedianMs - after.drawMedianMs),
      // shortcut: these bounds cover observation delay, not run-to-run statistical uncertainty.
      observationMedianReductionBoundsMs: [
        round(before.observationMedianMs[0] - after.observationMedianMs[1]),
        round(before.observationMedianMs[1] - after.observationMedianMs[0]),
      ],
    };
  });
  console.log(JSON.stringify({ metric: 'tap-down to destination heading OnDraw; destination pixels confirmed afterward',
    positiveReductionMeansFaster: true, warmOnly: true, comparison, runs }, null, 2));
}
