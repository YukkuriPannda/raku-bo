// lib/advance.ts の建て替え金額の算出を検算する（依存追加なし）。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../lib/advance.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { outputText, diagnostics = [] } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  reportDiagnostics: true,
});
const errors = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, 'advance.ts should transpile without diagnostics');

const compiled = { exports: {} };
new Function('module', 'exports', outputText)(compiled, compiled.exports);
const { advanceAmount, selfAmount, hasItemAdvance } = compiled.exports;

function tx(amount, { isAdvance = false, items } = {}) {
  return {
    id: 'tx',
    user_id: 'user',
    type: 'cash',
    amount,
    category: '食費',
    payment_method: 'cash',
    store_name: null,
    receipt_url: null,
    is_advance: isAdvance,
    settled_at: null,
    transacted_at: '2026-10-01T00:00:00.000Z',
    created_at: '2026-10-01T00:00:00.000Z',
    items: items && items.map(([name, price, is_advance], i) => ({
      id: `item-${i}`,
      transaction_id: 'tx',
      name,
      price,
      is_advance: !!is_advance,
      created_at: '2026-10-01T00:00:00.000Z',
    })),
  };
}

// 既存レシート（明細なし・フラグなし）は従来どおり全額が自分の支出
assert.equal(advanceAmount(tx(1000)), 0);
assert.equal(selfAmount(tx(1000)), 1000);

// レシート全体が建て替え
assert.equal(advanceAmount(tx(1000, { isAdvance: true })), 1000);
assert.equal(selfAmount(tx(1000, { isAdvance: true })), 0);

// 明細があってもフラグが無ければ全額が自分の支出
assert.equal(advanceAmount(tx(1000, { items: [['A', 400], ['B', 600]] })), 0);

// 一部だけ建て替え
const partial = tx(1000, { items: [['A', 400, true], ['B', 600]] });
assert.equal(advanceAmount(partial), 400);
assert.equal(selfAmount(partial), 600);
assert.equal(hasItemAdvance(partial), true);

// 全件建て替え
const all = tx(1000, { items: [['A', 400, true], ['B', 600, true]] });
assert.equal(advanceAmount(all), 1000);
assert.equal(selfAmount(all), 0);

// 値引きで明細合計が支払総額を上回る場合は支払総額で丸める（自己支出を負にしない）
const discounted = tx(800, { items: [['A', 500, true], ['B', 500, true]] });
assert.equal(advanceAmount(discounted), 800);
assert.equal(selfAmount(discounted), 0);

// 税が明細に乗らないレシート: 立替 + 自己支出 = レシート合計 を常に満たす
const taxed = tx(1100, { items: [['A', 400, true], ['B', 600]] });
assert.equal(advanceAmount(taxed) + selfAmount(taxed), 1100);
assert.equal(advanceAmount(taxed), 400);

// レシート全体の建て替えは明細のフラグより優先する（二重管理にしない）
assert.equal(advanceAmount(tx(1000, { isAdvance: true, items: [['A', 400, true], ['B', 600]] })), 1000);
assert.equal(hasItemAdvance(tx(1000, { isAdvance: true, items: [['A', 400, true]] })), false);

console.log('check-advance: ok');
