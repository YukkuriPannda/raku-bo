// Run from the repository root; optional git ref measures the same flows before a change.
// Native storage/widgets and API latency are simulated; no credentials or real records are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../..');
const mobileRequire = createRequire(path.join(root, 'mobile/package.json'));
const ts = mobileRequire('typescript');
const source = process.argv[2]
  ? execFileSync('git', ['show', `${process.argv[2]}:mobile/store/index.ts`], { cwd: root, encoding: 'utf8' })
  : fs.readFileSync(path.join(root, 'mobile/store/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const tx = (id, amount = 100, extra = {}) => ({
  id, user_id: 'fixture-user', type: 'cash', amount, category: '食費',
  payment_method: 'cash', store_name: 'fixture', is_advance: false, settled_at: null,
  transacted_at: `${month}-01T12:00:00`, ...extra,
});

function fixture() {
  const requests = [];
  const tasks = new Set();
  let heatmapWrites = 0;
  let dbFails = false;
  let apiFails = false;
  const request = (name, data) => {
    requests.push(name);
    const pending = new Promise((resolve) => setTimeout(() => resolve({ data }), 20));
    tasks.add(pending);
    pending.then(() => tasks.delete(pending));
    return pending;
  };
  const api = {
    transactionApi: {
      list: (m) => apiFails && m === month
        ? Promise.reject(new Error('fixture offline'))
        : request(`transactions:${m}`, m === month ? [tx('current'), tx('advance', 50, { is_advance: true })] : []),
      create: (data) => request('create', tx('new', data.amount)),
      update: (id, data) => request('update', tx(id, data.amount)),
      delete: () => request('delete', null),
      settle: (id, settled) => request('settle', tx(id, 50, { is_advance: true, settled_at: settled ? new Date().toISOString() : null })),
    },
    shiftApi: { list: () => request('shifts', [{ id: 'shift', duration_hours: 2, estimated_wage: 2000 }]) },
    plannedExpenditureApi: {
      list: () => request('planned', [{ id: 'planned', amount: 300 }]),
      create: () => request('planned-create', { id: 'planned-new', amount: 200 }),
      update: (id, data) => request('planned-update', { id, amount: data.amount }),
      delete: () => request('planned-delete', null),
      complete: () => request('complete', tx('completed', 300)),
    },
    profileApi: { update: () => request('profile-update', {}) },
  };
  const mocks = {
    '@/lib/api': api,
    '@/lib/auth': { signOut: async () => {} },
    '@/lib/auth-errors': { describeError: String },
    '@/lib/db': {
      cacheTransactions: async () => { if (dbFails) throw new Error('fixture storage failure'); },
      getCachedTransactions: async () => [], clearCache: async () => {},
    },
    '@/lib/widget-bridge': {
      saveWidgetBudget: () => {}, clearWidgetBudget: () => {},
      saveWidgetHeatmap: () => { heatmapWrites++; }, clearWidgetHeatmap: () => {},
    },
    '@/lib/notifications': { showReceiptQuickCaptureNotification: () => {}, clearReceiptQuickCaptureNotification: () => {} },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: (id) => mocks[id] ?? mobileRequire(id), console, Date, Map, Set,
  }, { filename: 'store/index.ts' });
  const store = exports.useAppStore;
  store.getState().setUser({ id: 'fixture-user', googleAccessToken: 'fixture-token' });
  const idle = async () => {
    while (tasks.size) await Promise.all([...tasks]);
    await new Promise((resolve) => setImmediate(resolve));
    if (tasks.size) await idle();
  };
  return { store, requests, idle, writes: () => heatmapWrites, failStorage: () => { dbFails = true; }, goOffline: () => { apiFails = true; } };
}

async function run() {
  const f = fixture();
  const results = [];
  async function measure(flow, action) {
    const count = f.requests.length;
    const writes = f.writes();
    const start = performance.now();
    await action();
    await f.idle();
    const calls = f.requests.slice(count);
    const result = {
      flow, settledMs: +(performance.now() - start).toFixed(2), requests: calls.length,
      pastMonthRequests: calls.filter((s) => s.startsWith('transactions:') && s !== `transactions:${month}`).length,
      heatmapWrites: f.writes() - writes,
    };
    results.push(result);
    return result;
  }
  const s = () => f.store.getState();
  const startup = await measure('initial-prefetch', () => s().prefetchInitialData());
  assert.equal(s().balance.remaining, 1600, '2000 income - 100 own spending - 300 planned');
  assert.equal(s().heatmapDays.length, 63);
  assert.equal(s().heatmapDays.reduce((sum, d) => sum + d.total, 0), 100, 'advances excluded');
  const warm = await measure('warm-tab-fetches', () => s().prefetchInitialData());
  assert.equal(warm.requests, 0, '30 second freshness remains effective');
  const shifts = await measure('shift-refresh', () => s().fetchShifts(month, { force: true }));
  const planned = await measure('planned-refresh', () => s().fetchPlannedExpenditures(month, { force: true }));
  const wage = await measure('wage-update', () => s().setHourlyWage(1200));
  assert.equal(s().balance.remaining, 2000);
  const plannedCreate = await measure('planned-create', () => s().addPlannedExpenditure({ amount: 200 }));
  const plannedUpdate = await measure('planned-update', () => s().updatePlannedExpenditure('planned-new', { amount: 250 }));
  const plannedDelete = await measure('planned-delete', () => s().deletePlannedExpenditure('planned-new'));
  assert.equal(s().balance.remaining, 2000);
  await measure('transaction-create', () => s().addTransaction({ amount: 200 }));
  assert.equal(s().balance.remaining, 1800);
  assert.equal(s().heatmapDays.reduce((sum, d) => sum + d.total, 0), 300);
  await measure('transaction-update', () => s().updateTransaction('new', { amount: 400 }));
  assert.equal(s().heatmapDays.reduce((sum, d) => sum + d.total, 0), 500);
  await measure('transaction-delete', () => s().deleteTransaction('new'));
  assert.equal(s().heatmapDays.reduce((sum, d) => sum + d.total, 0), 100);
  await measure('advance-settle', () => s().settleAdvance('advance', true));
  assert.equal(s().heatmapDays.reduce((sum, d) => sum + d.total, 0), 100);
  await measure('planned-complete', () => s().completePlannedExpenditure('planned'));
  assert.equal(s().heatmapDays.reduce((sum, d) => sum + d.total, 0), 400);
  f.failStorage();
  await measure('create-storage-failure', () => s().addTransaction({ amount: 250 }));
  assert.equal(s().transactions.find((t) => t.id === 'new').amount, 250, 'API success survives cache failure');
  if (!process.argv[2]) {
    assert.equal(startup.heatmapWrites, 1, 'one initial transaction load triggers one heatmap refresh');
    for (const result of [shifts, planned, wage, plannedCreate, plannedUpdate, plannedDelete]) {
      assert.equal(result.pastMonthRequests, 0, `${result.flow} must not fetch transaction history`);
      assert.equal(result.heatmapWrites, 0);
    }
    for (const result of results.slice(8)) assert.equal(result.heatmapWrites, 1, `${result.flow} refreshes heatmap`);
  }
  const currentTransactions = s().transactions;
  const currentBalance = s().balance;
  const pastMonth = '2020-01';
  const history = await measure('past-month-list', () => s().fetchTransactions(pastMonth));
  assert.equal(history.heatmapWrites, 0);
  assert.equal(s().transactions, currentTransactions, 'history navigation preserves current-month records');
  assert.equal(s().balance, currentBalance, 'history navigation preserves balance');
  const forced = await measure('force-current-refresh', () => s().fetchTransactions(month, { force: true }));
  assert.equal(forced.heatmapWrites, 1);
  f.goOffline();
  const offline = await measure('offline-current-refresh', () => s().fetchTransactions(month, { force: true }));
  assert.equal(offline.heatmapWrites, 1);
  assert.equal(s().transactions.length, 0, 'offline fallback fixture is used');
  console.log(JSON.stringify({ source: process.argv[2] ?? 'working-tree', simulatedApiMs: 20, results }, null, 2));
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
