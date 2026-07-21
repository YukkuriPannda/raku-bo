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
let db: SQLite.SQLiteDatabase | null = null;

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return db;
}

// ============================================================
// テーブル初期化
// アプリ起動時に一度呼び出す
// ============================================================
export async function initDB(): Promise<void> {
  const database = await getDB();
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
      transacted_at   TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at
      ON transactions (transacted_at);
  `);
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
           store_name, receipt_url, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.id,
          tx.user_id,
          tx.type,
          tx.amount,
          tx.category,
          tx.payment_method,
          tx.store_name ?? null,
          tx.receipt_url ?? null,
          tx.transacted_at,
          tx.created_at,
        ]
      );
    }
  });
}

// ============================================================
// キャッシュされたトランザクションを取得
// @param month "YYYY-MM" 形式
// ============================================================
export async function getCachedTransactions(month: string): Promise<Transaction[]> {
  const database = await getDB();

  // YYYY-MM の範囲でフィルタリング
  const rows = await database.getAllAsync<Transaction>(
    `SELECT * FROM transactions
     WHERE transacted_at LIKE ?
     ORDER BY transacted_at DESC`,
    [`${month}%`]
  );

  return rows;
}

// ============================================================
// キャッシュをすべてクリア（ログアウト時などに使用）
// ============================================================
export async function clearCache(): Promise<void> {
  const database = await getDB();
  await database.execAsync('DELETE FROM transactions;');
}
