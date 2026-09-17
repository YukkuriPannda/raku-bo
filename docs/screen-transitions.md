# 画面遷移図

実装にあるルートと主なユーザー操作を示す。矢印は代表的な遷移であり、全画面の戻る操作や各画面内の表示切り替えは省略する。

## モバイルアプリ

根拠: [`mobile/app/`](../mobile/app/) の Expo Router ルート、`(tabs)/_layout.tsx` のタブ・追加ボタン、`_layout.tsx` の認証ガード。

```mermaid
flowchart LR
    Start[起動・セッション確認] -->|未ログイン| Login[ログイン /login]
    Login -->|Google認証| Callback[認証コールバック /auth/callback]
    Callback -->|成功| Home[ホーム /]
    Callback -->|失敗| Login
    Start -->|ログイン済み| Home
    Home -->|セッション失効・ログアウト| Login

    Home <-->|下部タブ| History[履歴 /history]
    Home <-->|下部タブ| Shifts[シフト /shifts]
    Home <-->|下部タブ| Planned[支出予定 /planned-expenditures]

    Home -->|追加ボタン・レシート撮影| Camera[撮影 /screens/camera]
    Home -->|追加ボタン・手動入力| Manual[入力 /screens/manual-entry]
    Camera -->|撮影完了| Manual
    History -->|明細を長押しして編集| Manual
    Manual -->|保存| Home
    Camera -->|戻る| Home
    Manual -->|戻る| Home
```

モバイルの中央「追加」はタブの空きスロットに重ねたボタンで、独立した入力画面ではない。撮影後は入力画面に画像を引き渡し、そこで内容を確認・登録する。`支出予定` の追加・編集は同じ画面上のモーダルで行う。通知とアプリショートカットから撮影画面へ直接入る経路もある。

## Webアプリ

根拠: [`web/src/App.tsx`](../web/src/App.tsx) の React Router 定義と各ページの遷移処理。Webの下部ナビゲーションはホーム・履歴・シフトの3画面。

```mermaid
flowchart LR
    StartW[起動・セッション確認] -->|未ログイン| LoginW[ログイン /login]
    LoginW -->|Google認証| CallbackW[認証コールバック /auth/callback]
    CallbackW -->|成功| HomeW[ホーム /]
    StartW -->|ログイン済み| HomeW
    HomeW -->|セッション失効| LoginW

    HomeW <-->|下部ナビゲーション| HistoryW[履歴 /history]
    HomeW <-->|下部ナビゲーション| ShiftsW[シフト /shifts]
    HomeW -->|追加ボタン・撮影| CameraW[撮影 /camera]
    HomeW -->|追加ボタン・手動入力| ManualW[手動入力 /manual-entry]
    CameraW -->|撮影完了| ConfirmW[OCR結果確認 /confirm]
    ConfirmW -->|登録| HomeW
    ConfirmW -->|OCR結果がない場合| CameraW
    ManualW -->|登録| HomeW
```

Webにはモバイルの `支出予定` に対応するルートはない。撮影後のOCR確認は、モバイルと異なり `/confirm` という独立画面で行う。
