# ER図

Supabase PostgreSQL の永続データを示す。根拠は [`database/schema.sql`](../database/schema.sql) と `database/migrations/` の追加定義。`PK` は主キー、`FK` は外部キー。図のカーディナリティは外部キーの必須・任意性を表す。

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "id"
    PROFILES ||--o{ RECEIPTS : "user_id"
    PROFILES ||--o{ TRANSACTIONS : "user_id"
    PROFILES ||--o{ POINTS : "user_id"
    PROFILES ||--o{ PLANNED_EXPENDITURES : "user_id"
    RECEIPTS |o--o{ TRANSACTIONS : "receipt_id"
    TRANSACTIONS ||--o{ TRANSACTION_ITEMS : "transaction_id"

    AUTH_USERS {
        uuid id PK
    }
    PROFILES {
        uuid id PK,FK
        integer hourly_wage
        text google_calendar_token
        text_array shift_keywords
        timestamptz created_at
        timestamptz updated_at
    }
    RECEIPTS {
        uuid id PK
        uuid user_id FK
        text image_url
        jsonb raw_ocr_result
        timestamptz created_at
    }
    TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        text type
        integer amount
        text category
        text payment_method
        text store_name
        uuid receipt_id FK
        text receipt_url
        integer points_earned
        boolean is_advance
        timestamptz settled_at
        timestamptz transacted_at
        timestamptz created_at
        timestamptz updated_at
    }
    TRANSACTION_ITEMS {
        uuid id PK
        uuid transaction_id FK
        text name
        integer price
        timestamptz created_at
    }
    POINTS {
        uuid id PK
        uuid user_id FK
        text name
        integer amount
        numeric rate
        timestamptz created_at
        timestamptz updated_at
    }
    PLANNED_EXPENDITURES {
        uuid id PK
        uuid user_id FK
        text entry_type
        integer amount
        text category
        text payment_method
        text memo
        text service_name
        text billing_cycle
        integer billing_day
        integer billing_month
        boolean is_active
        text calendar_event_id
        text calendar_event_title
        date event_date
        timestamptz created_at
        timestamptz updated_at
    }
```

## 読み方と対象外

- `auth.users` は Supabase Auth が管理するテーブル。`profiles.id` が同じIDを参照し、ユーザー作成時のトリガーでプロフィールが作られる。
- `transactions.receipt_id` は任意。レシート削除時は `NULL` になり、取引自体は残る。商品明細は取引削除時に連動して削除される。
- `transactions.type` は `cash` / `point` / `income_forecast`。建て替えは別種別ではなく `is_advance` と `settled_at` で表す。
- `planned_expenditures.entry_type` は `subscription` / `calendar`。`calendar_event_id` は Google Calendar のイベントIDを保持する文字列で、DB上の外部キーではない。
- シフトは Google Calendar から取得し、シフト専用テーブルはない。レシート画像本体は Cloudflare R2、モバイル端末の SQLite は表示用キャッシュなので、このER図の対象外。
