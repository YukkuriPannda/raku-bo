// ============================================================
// hooks/useRefreshOnForeground.ts
// バックグラウンドから復帰したときにデータを取り直すためのフック
//
// 各タブは useFocusEffect で取得しているが、これは「画面のフォーカスが
// 変わったとき」にしか発火しない。アプリをホームに戻して開き直しただけ
// では画面のフォーカスは変わらないため再取得が走らず、表示が古いまま
// （起動直後に取得が失敗していた場合は空のまま）残ってしまう。
// フォアグラウンド復帰時にも取り直すことでこれを防ぐ。
// ============================================================

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export function useRefreshOnForeground(refresh: () => void) {
  const isFocused = useIsFocused();

  // 依存配列に refresh を入れるとレンダーのたびにリスナーを張り直すため、
  // 最新の関数を ref 経由で参照する
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // 表示中のタブだけ取り直す（裏のタブはフォーカス時に取得される）
      if (state === 'active' && isFocused) {
        refreshRef.current();
      }
    });
    return () => sub.remove();
  }, [isFocused]);
}
