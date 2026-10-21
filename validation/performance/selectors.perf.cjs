// Counts changed subscriber snapshots, not React commits or native frame times.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const mobileRequire = createRequire(path.join(root, 'mobile/package.json'));
const ts = mobileRequire('typescript');
const { createStore } = mobileRequire('zustand/vanilla');
const { shallow } = mobileRequire('zustand/vanilla/shallow');
const files = [
  'mobile/app/(tabs)/index.tsx', 'mobile/app/(tabs)/history.tsx',
  'mobile/app/(tabs)/shifts.tsx', 'mobile/app/(tabs)/planned-expenditures.tsx',
  'mobile/app/screens/manual-entry.tsx',
];
const results = [];
for (const file of files) {
  const text = process.argv[2]
    ? execFileSync('git', ['show', `${process.argv[2]}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useAppStore') {
      const arg = node.arguments[0];
      const isShallow = arg && ts.isCallExpression(arg) && arg.expression.getText(ast) === 'useShallow';
      const expr = isShallow ? arg.arguments[0] : arg;
      const selector = expr
        ? vm.runInThisContext(ts.transpile(`(${expr.getText(ast)})`, { target: ts.ScriptTarget.ES2020 }))
        : (s) => s;
      // Original destructuring names specify what this subscriber must continue to observe.
      const binding = node.parent.name;
      const keys = ts.isObjectBindingPattern(binding)
        ? binding.elements.map((e) => (e.propertyName ?? e.name).text)
        : [binding.text];
      const initial = Object.fromEntries(keys.map((key) => [key, {}]));
      const store = createStore(() => ({ ...initial, calendarEventsLoading: false }));
      let previous = selector(store.getState());
      let changes = 0;
      store.subscribe((state) => {
        const next = selector(state);
        if (!(isShallow ? shallow(previous, next) : Object.is(previous, next))) changes++;
        previous = next;
      });
      for (let i = 0; i < 100; i++) store.setState({ calendarEventsLoading: i % 2 === 0 });
      const unrelatedChanges = changes;
      for (const key of keys) store.setState({ [key]: {} });
      assert.equal(changes - unrelatedChanges, keys.length, `${file} must still observe every original field`);
      if (!process.argv[2]) assert.equal(unrelatedChanges, 0, `${file} observes an unrelated domain`);
      results.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, unrelatedChanges, relevantFieldsChecked: keys.length });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
assert.equal(results.length, 7, 'check all seven existing screen/form subscribers');
console.log(JSON.stringify({ source: process.argv[2] ?? 'working-tree', updates: 100, results }, null, 2));
