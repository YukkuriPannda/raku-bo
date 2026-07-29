// ============================================================
// lib/db.ts
// expo-sqlite によるローカルキャッシュ
// オフライン時にトランザクション履歴を参照できるようにする
// ============================================================

import * as SQLite from 'expo-sqlite';
import type { Transaction } from '@/types';

/** DB ファイル名 */
const DB_NAME = 'rakubo.db';

// ============================================================
// DB 接続（シングルトン）
// ============================================================
// 完了した接続ではなく「開いている途中のPromise」を保持する。
// getDB() は起動直後に複数箇所から並行で呼ばれる（セッション復元・キャッシュ読み書き・
// initDB）ため、完了後にだけ代入する方式だと初期化が終わる前の呼び出しがそれぞれ
// openDatabaseAsync を走らせてしまい、同じDBを何重にも開いて不安定になる。
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// テーブル作成はDB初回オープン時に済ませる（initDB()の呼び出し順に依存しないようにするため）。
// lib/auth.ts の LargeSecureStore は initDB() を待たずに getDB() 経由で
// kv_store テーブルへアクセスすることがある。
function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      // 失敗した Promise を握ったままにすると以降ずっと同じエラーを返し続けるため、
      // 次の呼び出しでやり直せるようにリセットする
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DB_NAME);
  await database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        type            TEXT NOT NULL,
        amount          INTEGER NOT NULL,
        category        TEXT NOT NULL,
        payment_method  TEXT NOT NULL,
        store_name      TEXT,
        receipt_url     TEXT,
        is_advance      INTEGER NOT NULL DEFAULT 0,
        settled_at      TEXT,
        transacted_at   TEXT NOT NULL,
        created_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at
        ON transactions (transacted_at);

      CREATE TABLE IF NOT EXISTS kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  await migrateTransactionColumns(database);
  return database;
}

// ============================================================
// 既存インストール向けの列追加
// CREATE TABLE IF NOT EXISTS は既にテーブルがある場合に何もしないため、
// アップデートで増えた列は ALTER TABLE で足す必要がある。
// これを怠ると cacheTransactions の INSERT が
// 「table transactions has no column named ...」で失敗し、
// オフライン用のキャッシュが一切書けなくなる。
//
// 列の有無は PRAGMA table_info では調べない（Android の expo-sqlite で
// prepareAsync が NullPointerException になることがあり、そこで初期化が
// 止まると kv_store も読めなくなってセッションごと壊れる）。
// 代わりに ALTER を実行し、既に存在する場合のエラーだけ握りつぶす。
// ============================================================
async function migrateTransactionColumns(database: SQLite.SQLiteDatabase): Promise<void> {
  const statements = [
    'ALTER TABLE transactions ADD COLUMN is_advance INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE transactions ADD COLUMN settled_at TEXT;',
  ];

  for (const sql of statements) {
    try {
      await database.execAsync(sql);
    } catch (error) {
      // "duplicate column name" は列が既にある場合なので想定内。
      // それ以外の失敗も、ここで throw すると DB 全体が使えなくなるため
      // ログだけ残して続行する（キャッシュが古い形式のまま動く）。
      const message = String(error);
      if (!message.includes('duplicate column name')) {
        console.warn('[db] 列の追加に失敗:', message);
      }
    }
  }
}

// ============================================================
// テーブル初期化
// アプリ起動時に一度呼び出す（省略してもgetDB()側で自動的に初期化される）
// ============================================================
export async function initDB(): Promise<void> {
  await getDB();
}

// ============================================================
// 汎用キー・バリューストア
// SecureStore（Android/iOSで単一値2048バイト制限あり）に収まらない
// 大きめの値（Supabaseセッションの暗号化データなど）を保存するために使う。
// 値そのものはここでは暗号化しない（呼び出し側でSecureStore管理の鍵を
// 使って暗号化した上で渡すこと）
// ============================================================
export async function getKVItem(key: string): Promise<string | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv_store WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setKVItem(key: string, value: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)', [key, value]);
}

export async function removeKVItem(key: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM kv_store WHERE key = ?', [key]);
}

// ============================================================
// トランザクションをローカル DB に UPSERT（キャッシュ）
// ============================================================
export async function cacheTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;

  const database = await getDB();

  // バッチ INSERT OR REPLACE
  await database.withTransactionAsync(async () => {
    for (const tx of transactions) {
      await database.runAsync(
        `INSERT OR REPLACE INTO transactions
          (id, user_id, type, amount, category, payment_method,
           store_name, receipt_url, is_advance, settled_at, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.id,
          tx.user_id,
          tx.type,
          tx.amount,
          tx.category,
          tx.payment_method,
          tx.store_name ?? null,
          tx.receipt_url ?? null,
          tx.is_advance ? 1 : 0,
          tx.settled_at ?? null,
          tx.transacted_at,
          tx.created_at,
        ]
      );
    }
  });
}

// ============================================================
// キャッシュされたトランザクションを取得
//
// user_id で必ず絞る。1台の端末を複数アカウントで使った場合
// （セッション失効後に別アカウントでログインしたケースを含む）、
// 絞らないと前のユーザーの支出履歴が表示され、さらに calcBalance が
// その金額で残高を計算してしまう。
//
// @param month  "YYYY-MM" 形式
// @param userId 現在ログイン中のユーザーID。無い場合は何も返さない
// ============================================================
export async function getCachedTransactions(month: string, userId: string | null): Promise<Transaction[]> {
  // 誰のキャッシュか特定できないときは表示しない（fail closed）
  if (!userId) return [];

  const database = await getDB();

  const rows = await database.getAllAsync<Omit<Transaction, 'is_advance'> & { is_advance: number }>(
    `SELECT * FROM transactions
     WHERE user_id = ? AND transacted_at LIKE ?
     ORDER BY transacted_at DESC`,
    [userId, `${month}%`]
  );

  // SQLite に真偽値型はないため 0/1 で保存している。boolean に戻す
  return rows.map((row) => ({ ...row, is_advance: row.is_advance === 1 }));
}

// ============================================================
// キャッシュをすべてクリア
//
// 明示的なログアウト（store.logout）だけでなく、セッション失効による
// サインアウト経路（app/_layout.tsx の onAuthStateChange）からも呼ぶこと。
// 片方だけだと、失効後に別アカウントでログインしたときに前のユーザーの
// キャッシュが残る。
// ============================================================
export async function clearCache(): Promise<void> {
  const database = await getDB();
  await database.execAsync('DELETE FROM transactions;');
}
