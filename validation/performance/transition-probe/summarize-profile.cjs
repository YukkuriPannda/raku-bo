const fs = require('node:fs');
const assert = require('node:assert/strict');
const selfNames = ['(idle)', 'unstable_now', 'numberPrototypeToLocaleString'];
const inclusiveNames = ['performWorkOnRoot', 'renderRootSync', 'renderWithHooks'];
const selfCheck = process.argv[2] === '--self-check';
const fixtureNames = ['performWorkOnRoot', 'renderRootSync', 'renderWithHooks',
  'unstable_now', 'numberPrototypeToLocaleString', '(idle)', 'renderWithHooks', 'unstable_now'];
const fixtureParents = [undefined, 1, 2, 3, 3, 1, 3, 7];
const events = selfCheck ? [{ name: 'ProfileChunk', args: { data: {
  cpuProfile: { nodes: fixtureNames.map((functionName, i) => ({ id: i + 1, parent: fixtureParents[i], callFrame: { functionName } })), samples: [4, 5, 6, 8] },
  timeDeltas: [1000, 2000, 3000, 4000],
} } }] : JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).traceEvents;
const chunks = events.filter(e => e.name === 'ProfileChunk');
assert(chunks.length > 0, 'No Hermes ProfileChunk events');
const nodes = new Map(chunks.flatMap(e => e.args.data.cpuProfile.nodes).map(n => [n.id, n]));
const own = new Map();
const inclusive = new Map();
let totalUs = 0;
let samples = 0;
for (const { args: { data } } of chunks) {
  assert.equal(data.cpuProfile.samples.length, data.timeDeltas.length);
  for (let i = 0; i < data.timeDeltas.length; i++) {
    const id = data.cpuProfile.samples[i];
    const us = data.timeDeltas[i];
    assert(nodes.has(id) && Number.isFinite(us) && us >= 0);
    samples++;
    totalUs += us;
    const name = nodes.get(id).callFrame.functionName;
    own.set(name, (own.get(name) || 0) + us);
    let node = nodes.get(id);
    const visited = new Set();
    const names = new Set();
    while (node) {
      assert(!visited.has(node.id), 'Cycle in sampled call stack');
      visited.add(node.id);
      names.add(node.callFrame.functionName);
      if (node.parent !== undefined) assert(nodes.has(node.parent), 'Missing sampled parent');
      node = nodes.get(node.parent);
    }
    for (const parentName of names) inclusive.set(parentName, (inclusive.get(parentName) || 0) + us);
  }
}
assert(samples > 0 && totalUs > 0);
if (selfCheck) {
  assert.equal(samples, 4);
  assert.equal(totalUs, 10000);
  assert.equal(own.get('unstable_now'), 5000);
  assert.equal(inclusive.get('renderRootSync'), 7000);
  assert.equal(inclusive.get('renderWithHooks'), 7000, 'Recursive stack was counted twice');
}
const round = value => Math.round(value * 1000) / 1000;
const collect = (map, names) => names.map(name => {
  assert(map.has(name), `Missing expected function: ${name}`);
  return { name, ms: round(map.get(name) / 1000), percentOfSampledTime: round(map.get(name) / totalUs * 100) };
});
console.log(JSON.stringify({ samples, sampledMs: totalUs / 1000,
  self: collect(own, selfNames), inclusive: collect(inclusive, inclusiveNames),
  note: 'All call sites combined by function name; inclusive stacks overlap between functions. No URLs or app records exported.' }, null, 2));
