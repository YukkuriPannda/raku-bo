const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const mobileRequire = createRequire(path.join(root, 'mobile/package.json'));
const ts = mobileRequire('typescript');
const source = fs.readFileSync(path.join(root, 'mobile/lib/number-format.ts'), 'utf8');
let constructors = 0;
const loaded = {};
vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), {
  exports: loaded,
  Intl: {
    NumberFormat: function (...args) {
      constructors++;
      return new Intl.NumberFormat(...args);
    },
  },
});
assert.equal(constructors, 1, 'Initialize one formatter per module');
const values = [0, -0, 1, -1, 1234, -1234, 0.0001, 1.2344, 1.2345,
  -1.2345, 999999.9995, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
  Number.MAX_VALUE, Number.MIN_VALUE, NaN, Infinity, -Infinity];
for (let i = -500; i <= 500; i++) values.push(i * 1234.56789);
for (const value of values) {
  assert.equal(loaded.formatNumberJa(value), value.toLocaleString('ja-JP'), `Formatting changed for ${value}`);
}
assert.equal(constructors, 1, 'Repeated formatting must reuse the formatter');

// Widget JSX can be checked without starting a native widget or writing any records.
function loadWidget(source) {
  const result = {};
  vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }), {
    exports: result,
    require(name) {
      if (name === 'react-native-android-widget') return { FlexWidget: 'FlexWidget', TextWidget: 'TextWidget' };
      if (name === '@/lib/number-format') return loaded;
      if (name === 'react/jsx-runtime') return mobileRequire(name);
      throw new Error(`Unexpected widget dependency: ${name}`);
    },
  });
  return result.RemainingBudgetWidget;
}
function texts(element) {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(texts);
  return [...(element.type === 'TextWidget' ? [element.props.text] : []), ...texts(element.props?.children)];
}
const widgetFile = 'mobile/widgets/RemainingBudgetWidget.tsx';
const beforeWidget = loadWidget(execFileSync('git', ['show', `54ab245:${widgetFile}`], { cwd: root, encoding: 'utf8' }));
const afterWidget = loadWidget(fs.readFileSync(path.join(root, widgetFile), 'utf8'));
for (const budget of [null, 0, -12345.678, 1234567]) {
  const props = { budget, unsettledAdvance: 1234, recentTransactions: [{ label: 'fixture', amount: 2345.6 }],
    upcomingPlanned: [{ label: 'fixture', amount: -3456.7 }] };
  assert.deepEqual(texts(afterWidget(props)), texts(beforeWidget(props)), 'Widget display changed');
}
console.log(JSON.stringify({ cases: values.length, constructors, equivalent: true, widgetFixtures: 4 }));
