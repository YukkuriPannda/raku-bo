// Runs the actual screen components with a small hook/memo harness. This checks
// render decisions and produced element props; it is not a React Native mount.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const mobileRequire = createRequire(path.join(root, 'mobile/package.json'));
const ts = mobileRequire('typescript');
const React = mobileRequire('react');
const memoSymbol = Symbol.for('react.memo');

function shallowEqual(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key])
  );
}

function createHooks() {
  const slots = [];
  let cursor = 0;
  return {
    react: {
      createElement: React.createElement,
      memo: React.memo,
      useCallback(callback, deps) {
        const index = cursor++;
        const previous = slots[index];
        if (!previous || !shallowEqual(previous.deps, deps)) {
          slots[index] = { deps, value: callback };
        }
        return slots[index].value;
      },
      useMemo(factory) { return factory(); },
      useState(initial) {
        const index = cursor++;
        if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, (value) => {
          slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        }];
      },
    },
    beginRender() { cursor = 0; },
  };
}

function loadTypeScript(file, mocks, hooks) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (id) => {
    if (id === 'react') return hooks.react;
    if (id === 'react/jsx-runtime') return mobileRequire(id);
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    return mobileRequire(id);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', output)(
    localRequire, loaded, loaded.exports, filename, path.dirname(filename)
  );
  return loaded.exports;
}

const styles = new Proxy({}, { get: (_target, key) => String(key) });
const native = Object.fromEntries([
  'ActivityIndicator', 'FlatList', 'KeyboardAvoidingView', 'Modal', 'RefreshControl',
  'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View',
].map((name) => [name, name]));
native.Platform = { OS: 'android' };
native.Alert = { alert() {} };

const heatmap = loadTypeScript('mobile/lib/heatmap.ts', {}, createHooks());
const numberFormat = loadTypeScript('mobile/lib/number-format.ts', {}, createHooks());
const homeHooks = createHooks();
let homeState;
const router = { push() {} };
const homeMocks = {
  'react-native': native,
  'expo-router': { useRouter: () => router },
  '@react-navigation/native': { useFocusEffect() {} },
  'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
  'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle' },
  '@/store': { useAppStore: (selector) => selector(homeState) },
  '@/types': { ALL_CATEGORIES: ['食費', '交通費', '娯楽', 'その他'] },
  '@/constants/theme': { colors: { primary: '#16824a' } },
  '@/styles/index.styles': { styles },
  '@/lib/heatmap': heatmap,
  '@/lib/number-format': numberFormat,
  '@/hooks/useSwipeTabNavigation': { useSwipeTabNavigation: () => null },
  '@/hooks/useRefreshOnForeground': { useRefreshOnForeground() {} },
  'zustand/react/shallow': { useShallow: (selector) => selector },
};
const HomeScreen = loadTypeScript('mobile/app/(tabs)/index.tsx', homeMocks, homeHooks).default;

function elementChildren(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) elementChildren(child, visit);
  } else if (React.isValidElement(node)) {
    visit(node);
    elementChildren(node.props.children, visit);
  }
}

function findElement(tree, predicate) {
  let result;
  elementChildren(tree, (element) => {
    if (!result && predicate(element)) result = element;
  });
  assert.ok(result, 'expected element was not found');
  return result;
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return React.isValidElement(node) ? textContent(node.props.children) : '';
}

function memoName(element) {
  return element.type && element.type.$$typeof === memoSymbol ? element.type.type.name : '';
}

function renderMemo(element, cache, counts) {
  const type = element.type;
  assert.equal(type && type.$$typeof, memoSymbol, `${memoName(element) || 'child'} must use React.memo`);
  assert.equal(type.compare, null, `${memoName(element)} must use the default shallow comparison`);
  const previous = cache.get(type);
  if (previous && shallowEqual(previous.props, element.props)) return previous.output;
  const name = memoName(element);
  counts[name] = (counts[name] ?? 0) + 1;
  const output = type.type(element.props);
  cache.set(type, { props: element.props, output });
  return output;
}

function makeDays(endKey, lastTotal) {
  const [year, month, day] = endKey.split('-').map(Number);
  const end = new Date(year, month - 1, day);
  return Array.from({ length: 63 }, (_, index) => {
    const date = new Date(end);
    date.setDate(date.getDate() - (62 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: key, total: index === 62 ? lastTotal : 0 };
  });
}

function heatmapCellColors(tree) {
  const colors = [];
  elementChildren(tree, (element) => {
    if (element.type !== 'View' || !Array.isArray(element.props.style) || !element.props.style.includes('heatmapCell')) return;
    const color = element.props.style.find((value) => value && typeof value === 'object' && 'backgroundColor' in value)?.backgroundColor;
    if (color) colors.push(color);
  });
  return colors;
}

const homeMemoCache = new Map();
const homeCounts = {};
const firstDays = makeDays('2026-10-31', 0);
const baseBalance = {
  remaining: 10000,
  net_expense_total: 0,
  advance_total: 0,
  advance_unsettled_total: 0,
  income_forecast: 20000,
  planned_total: 0,
};
homeState = {
  balance: baseBalance,
  transactions: [],
  transactionsLoading: false,
  shiftsLoading: false,
  plannedExpendituresLoading: false,
  transactionsLoaded: true,
  shiftsLoaded: true,
  plannedExpendituresLoaded: true,
  fetchTransactions: async () => {},
  fetchShifts: async () => {},
  fetchPlannedExpenditures: async () => {},
  heatmapDays: firstDays,
};
function renderHome() {
  homeHooks.beginRender();
  return HomeScreen();
}
function homeChart(tree, name) {
  return findElement(tree, (element) => memoName(element) === name);
}

let homeTree = renderHome();
let chartOutput = renderMemo(homeChart(homeTree, 'CategorySpendingChart'), homeMemoCache, homeCounts);
let heatmapOutput = renderMemo(homeChart(homeTree, 'SpendingHeatmap'), homeMemoCache, homeCounts);
assert.match(textContent(chartOutput), /この月の支出データはまだありません/);
assert.ok(heatmapCellColors(heatmapOutput).includes(heatmap.LEVEL_COLORS[0]));

homeState = { ...homeState, shiftsLoading: true };
homeTree = renderHome();
chartOutput = renderMemo(homeChart(homeTree, 'CategorySpendingChart'), homeMemoCache, homeCounts);
heatmapOutput = renderMemo(homeChart(homeTree, 'SpendingHeatmap'), homeMemoCache, homeCounts);
assert.deepEqual(homeCounts, { CategorySpendingChart: 1, SpendingHeatmap: 1 }, 'unrelated loading changes must skip both charts');

homeState = {
  ...homeState,
  transactions: [{ type: 'cash', is_advance: false, amount: 1200, category: '食費' }],
};
homeTree = renderHome();
chartOutput = renderMemo(homeChart(homeTree, 'CategorySpendingChart'), homeMemoCache, homeCounts);
heatmapOutput = renderMemo(homeChart(homeTree, 'SpendingHeatmap'), homeMemoCache, homeCounts);
assert.equal(homeCounts.CategorySpendingChart, 2, 'new transactions must rerender the category chart');
assert.equal(homeCounts.SpendingHeatmap, 1, 'new transactions alone must not rerender the heatmap');
assert.match(textContent(chartOutput), /食費/);
assert.match(textContent(chartOutput), /¥1,200/);

const nextDays = makeDays('2026-11-01', 200);
homeState = { ...homeState, heatmapDays: nextDays };
homeTree = renderHome();
chartOutput = renderMemo(homeChart(homeTree, 'CategorySpendingChart'), homeMemoCache, homeCounts);
heatmapOutput = renderMemo(homeChart(homeTree, 'SpendingHeatmap'), homeMemoCache, homeCounts);
assert.equal(nextDays.length, 63);
assert.equal(nextDays[0].date, '2026-08-31');
assert.equal(nextDays.at(-1).date, '2026-11-01');
assert.equal(homeCounts.SpendingHeatmap, 2, 'a new 63-day window must rerender the heatmap');
assert.match(textContent(heatmapOutput), /11月/, 'the month label must follow the updated window');
assert.ok(heatmapCellColors(heatmapOutput).includes(heatmap.LEVEL_COLORS[4]), 'new spend data must change the heatmap level');

const shiftHooks = createHooks();
let clearErrorCalls = 0;
let shiftState = {
  shifts: [],
  balance: { income_forecast: 1000 },
  hourlyWage: 1000,
  shiftKeywords: ['勤務'],
  shiftsLoading: false,
  calendarError: null,
  clearCalendarError: () => { clearErrorCalls++; },
  fetchShifts: async () => {},
  setHourlyWage() {},
  setShiftKeywords: async () => {},
  logout() {},
};
const shiftMocks = {
  '@/lib/number-format': numberFormat,
  'react-native': native,
  '@react-navigation/native': { useFocusEffect() {} },
  'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
  '@/store': { useAppStore: (selector) => selector(shiftState) },
  '@/constants/theme': { colors: { primary: '#16824a', textSecondary: '#777' } },
  '@/styles/shifts.styles': { styles },
  '@/hooks/useSwipeTabNavigation': { useSwipeTabNavigation: () => null },
  '@/hooks/useRefreshOnForeground': { useRefreshOnForeground() {} },
  '@/types': {},
  'zustand/react/shallow': { useShallow: (selector) => selector },
};
const ShiftsScreen = loadTypeScript('mobile/app/(tabs)/shifts.tsx', shiftMocks, shiftHooks).default;
function renderShifts() {
  shiftHooks.beginRender();
  return ShiftsScreen();
}
function listHeader(tree) {
  const flatList = findElement(tree, (element) => element.type === 'FlatList');
  assert.ok(React.isValidElement(flatList.props.ListHeaderComponent), 'header must be a stable component element');
  return flatList.props.ListHeaderComponent;
}
function headerOutput(element, cache, counts) {
  return renderMemo(element, cache, counts);
}

const shiftHeaderCache = new Map();
const shiftHeaderCounts = {};
const firstShiftTree = renderShifts();
const firstHeader = listHeader(firstShiftTree);
let headerTree = headerOutput(firstHeader, shiftHeaderCache, shiftHeaderCounts);
assert.match(textContent(headerTree), /¥1,000/);

shiftState = { ...shiftState, shiftsLoading: true };
const loadingShiftTree = renderShifts();
const loadingHeader = listHeader(loadingShiftTree);
assert.equal(loadingHeader.type, firstHeader.type, 'parent updates must keep the header component type stable');
headerTree = headerOutput(loadingHeader, shiftHeaderCache, shiftHeaderCounts);
assert.equal(shiftHeaderCounts.ShiftsListHeader, 1, 'unrelated loading changes must skip the header');

shiftState = { ...shiftState, balance: { income_forecast: 2500 }, calendarError: 'カレンダー取得エラー' };
const changedShiftTree = renderShifts();
const changedHeader = listHeader(changedShiftTree);
assert.equal(changedHeader.type, firstHeader.type, 'income and error changes must preserve header identity');
headerTree = headerOutput(changedHeader, shiftHeaderCache, shiftHeaderCounts);
assert.equal(shiftHeaderCounts.ShiftsListHeader, 2);
assert.match(textContent(headerTree), /¥2,500/);
assert.match(textContent(headerTree), /カレンダー取得エラー/);

const errorDismiss = findElement(headerTree, (element) => element.type === 'TouchableOpacity' && textContent(element).includes('✕'));
errorDismiss.props.onPress();
assert.equal(clearErrorCalls, 1, 'the calendar-error dismiss action must remain connected');
const settingsButton = findElement(headerTree, (element) => element.type === 'TouchableOpacity' && textContent(element).includes('⚙️'));
settingsButton.props.onPress();
const settingsTree = renderShifts();
assert.equal(findElement(settingsTree, (element) => element.type === 'Modal').props.visible, true, 'the settings action must open the modal');

console.log(JSON.stringify({
  renderer: 'minimal hook/memo harness; not a React Native mount',
  home: { renders: homeCounts, checks: ['unrelated loading skipped', 'transaction update reflected', '63-day rollover reflected'] },
  shifts: { headerRenders: shiftHeaderCounts.ShiftsListHeader, checks: ['stable header type', 'income and error updates reflected', 'error dismiss works', 'settings opens'] },
}, null, 2));
