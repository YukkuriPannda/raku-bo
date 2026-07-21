// ============================================================
// index.js
// カスタムエントリーポイント
//
// expo-router/entry の副作用（ルートコンポーネント登録）を維持しつつ、
// Android ウィジェットの headless task ハンドラーを追加登録する。
// ============================================================

import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
