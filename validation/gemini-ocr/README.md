# Gemini 2.5 Flash OCR 検証

レシート画像を Gemini 2.5 Flash に送り、構造化 JSON（OcrResult 型）として
解析できるかを確認するスクリプトです。

## 前提条件

- Node.js 18 以上
- Google AI Studio または Vertex AI の Gemini API キー

## セットアップ

### 1. 依存パッケージのインストール

`validation/` ディレクトリで実行してください。

```bash
cd validation
npm install
```

### 2. 環境変数の設定

**.env ファイルを使う場合（推奨）**

リポジトリルートの `.env` に以下を追加します（`.env.example` を参照）。

```
GEMINI_API_KEY=your_api_key_here
```

その後、スクリプト実行前に読み込みます。

```bash
# bash/zsh
export $(grep -v '^#' ../../.env | xargs)
```

**一時的に設定する場合**

```bash
export GEMINI_API_KEY=your_api_key_here
```

**Windows (PowerShell) の場合**

```powershell
$env:GEMINI_API_KEY = "your_api_key_here"
```

### 3. サンプル画像の配置

`validation/gemini-ocr/sample.jpg` にレシートの画像ファイルを配置してください。

```
validation/
  gemini-ocr/
    sample.jpg   ← ここに配置
    test.ts
    README.md
```

- JPEG 形式を推奨します。
- 画像は鮮明で、文字が読み取りやすいものを使用してください。
- ファイルが存在しない場合はスクリプトがガイダンスを表示して終了します。

## 実行

```bash
# validation/ ディレクトリから
npm run ocr

# または直接実行
npx tsx gemini-ocr/test.ts
```

## 期待される出力

成功した場合、以下のような JSON が表示されます。

```json
{
  "store_name": "セブンイレブン 渋谷店",
  "date": "2026-04-20",
  "items": [
    { "name": "おにぎり 鮭", "price": 150 },
    { "name": "お茶 500ml", "price": 120 }
  ],
  "total_amount": 270,
  "category": "食費",
  "payment_method": "qr",
  "points_earned": 3
}
```

## OcrResult 型定義

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `store_name` | `string` | ✓ | 店名 |
| `date` | `string` | ✓ | 購入日（YYYY-MM-DD） |
| `items` | `OcrItem[]` | ✓ | 購入品目の配列 |
| `total_amount` | `integer` | ✓ | 合計金額（円） |
| `category` | `string` (enum) | ✓ | カテゴリ（下記参照） |
| `payment_method` | `'cash'`\|`'card'`\|`'qr'` | ✓ | 支払い方法 |
| `points_earned` | `integer`\|`null` | - | 獲得ポイント数 |

### category の選択肢

`食費` / `交通費` / `娯楽` / `衣類` / `医療` / `教育・書籍` /
`カフェ・飲み物` / `家賃・光熱費` / `日用品` / `その他`

## トラブルシューティング

| 症状 | 対処法 |
|---|---|
| `GEMINI_API_KEY が設定されていません` | 環境変数を設定してください |
| `sample.jpg が見つかりません` | 画像を正しいパスに配置してください |
| HTTP 400 / 403 エラー | API キーが正しいか確認してください |
| HTTP 429 エラー | レート制限です。しばらく待ってから再実行してください |
| JSON パースエラー | モデルの出力が壊れています。再実行するか画像を変えてください |
