const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../lib/history-summary.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { outputText, diagnostics = [] } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  reportDiagnostics: true,
});
const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, 'history-summary.ts should transpile without diagnostics');

const compiled = { exports: {} };
new Function('module', 'exports', outputText)(compiled, compiled.exports);
const buildHistoryExpenseSummary = compiled.exports.buildHistoryExpenseSummary;

function transaction(id, amount, category, overrides = {}) {
  return {
    id,
    user_id: 'user',
    type: 'cash',
    amount,
    category,
    payment_method: 'cash',
    store_name: null,
    receipt_url: null,
    is_advance: false,
    settled_at: null,
    transacted_at: '2026-10-01T00:00:00.000Z',
    created_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function expectSummary(records, total, categories) {
  const actual = buildHistoryExpenseSummary(records);
  assert.deepEqual(actual, { total, categories });
  assert.equal(actual.categories.reduce((sum, item) => sum + item.amount, 0), actual.total);
  return actual;
}

expectSummary([], 0, []);
expectSummary([
  transaction('forecast', 90, '食費', { type: 'income_forecast' }),
  transaction('other', 40, '交通費', { type: 'income_forecast' }),
], 0, []);

expectSummary([
  transaction('food-1', 120, '食費'),
  transaction('food-2', 30, '食費'),
], 150, [{ category: '食費', amount: 150 }]);

expectSummary([
  transaction('cash', 11, '食費', { payment_method: 'cash' }),
  transaction('card', 22, '交通費', { payment_method: 'card' }),
  transaction('qr', 33, '食費', { payment_method: 'qr' }),
  transaction('settled-advance', 44, '教育・書籍', { is_advance: true, settled_at: '2026-10-02T00:00:00.000Z' }),
  transaction('unsettled-advance', 55, '教育・書籍', { is_advance: true, settled_at: null }),
  transaction('forecast', 999, 'その他', { type: 'income_forecast' }),
], 165, [
  { category: '教育・書籍', amount: 99 },
  { category: '食費', amount: 44 },
  { category: '交通費', amount: 22 },
]);

const longCategory = '利用者が追加した長いカテゴリ名（表示時に折り返して省略しない）';
expectSummary([
  transaction('tiny', 1, '小額'),
  transaction('large', 1_000_000_000, '大額'),
  transaction('tie-a', 8, 'カスタムA'),
  transaction('long', 8, longCategory),
  transaction('tie-b', 8, 'カスタムB'),
], 1_000_000_025, [
  { category: '大額', amount: 1_000_000_000 },
  { category: 'カスタムA', amount: 8 },
  { category: longCategory, amount: 8 },
  { category: 'カスタムB', amount: 8 },
  { category: '小額', amount: 1 },
]);

const original = Object.freeze([
  Object.freeze(transaction('one', 100, '食費')),
  Object.freeze(transaction('two', 200, '交通費')),
]);
const before = JSON.stringify(original);
expectSummary(original, 300, [
  { category: '交通費', amount: 200 },
  { category: '食費', amount: 100 },
]);
assert.equal(JSON.stringify(original), before, 'summary must not mutate source records');

const added = [...original, transaction('three', 50, '食費')];
expectSummary(added, 350, [
  { category: '交通費', amount: 200 },
  { category: '食費', amount: 150 },
]);

const edited = original.map((item) => item.id === 'one'
  ? { ...item, amount: 400, category: '衣類' }
  : item);
expectSummary(edited, 600, [
  { category: '衣類', amount: 400 },
  { category: '交通費', amount: 200 },
]);

const deleted = original.filter((item) => item.id !== 'one');
expectSummary(deleted, 200, [{ category: '交通費', amount: 200 }]);

const movedOut = original.filter((item) => item.id !== 'two');
const movedIn = [original.find((item) => item.id === 'two')];
expectSummary(movedOut, 100, [{ category: '食費', amount: 100 }]);
expectSummary(movedIn, 200, [{ category: '交通費', amount: 200 }]);
assert.equal(JSON.stringify(original), before, 'derived month arrays must leave their source unchanged');

console.log('history summary self-check passed');
