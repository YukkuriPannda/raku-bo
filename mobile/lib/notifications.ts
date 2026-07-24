// ============================================================
// lib/notifications.ts
// ロック画面にも表示され続ける常駐通知（レシート撮影への素早い導線）
// ログイン中は常に表示し、タップで screens/camera へ遷移する。
// ロック画面ウィジェットはNothing OSで追加できなかったため、
// OS標準の通知APIで代替する（sticky通知はAndroidのみ対応）。
// ============================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'receipt-quick-capture';
const NOTIFICATION_ID = 'receipt-quick-capture';

// アプリがフォアグラウンドの状態で表示要求されても通知欄に出す
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'レシート撮影',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** ロック画面にも表示される常駐通知を出す（残額が変わるたびに呼ぶ。iOSでは何もしない） */
export async function showReceiptQuickCaptureNotification(remaining: number): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;

    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: '📷 レシートを撮影',
        body: `今月あと¥${remaining.toLocaleString('ja-JP')}`,
        sticky: true, // スワイプで消せない（Androidのongoing通知）
        autoDismiss: false, // タップしても消えない
        data: { screen: '/screens/camera' },
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (error) {
    console.error('[showReceiptQuickCaptureNotification] エラー:', error);
  }
}

/** ログアウト時に常駐通知を消す */
export async function clearReceiptQuickCaptureNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch (error) {
    console.error('[clearReceiptQuickCaptureNotification] エラー:', error);
  }
}
