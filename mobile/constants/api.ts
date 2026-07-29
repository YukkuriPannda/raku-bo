// ============================================================
// constants/api.ts
// バックエンドの接続先を決める
//
// 開発中は各自のPC（Tailscale/LAN上の wrangler dev）を向くが、
// リリースビルドがその設定を拾ってしまうと、配布したアプリが
// 開発機を探しに行くことになる（開発機が落ちていればアプリは
// 何も表示できず、動いていれば意図せず開発機へ接続してしまう）。
//
// そのため配布ビルドでは「開発用に見えるURL」を採用せず、
// 必ず本番のWorkerへフォールバックする。
// ============================================================

/** 本番バックエンド（Cloudflare Workers）。配布ビルドは必ずここを向く */
export const PRODUCTION_API_URL = 'https://raku-bo-backend.funa-hayate.workers.dev';

/** 開発時に EXPO_PUBLIC_API_URL が未設定だった場合の既定値 */
const DEV_FALLBACK_API_URL = 'http://localhost:8787';

/**
 * 配布ビルドで接続を許可するオリジン。
 *
 * 当初は「開発用に見えるURLを弾く」ブロックリスト方式にしていたが、
 * その判定は素朴な文字列分割だったため次の書き方をすべて取りこぼしていた:
 *   https://<本番ホスト>@192.168.1.5   userinfo の後ろが実際の接続先になる
 *   https://[::1]:8787                 IPv6 リテラル
 *   https://127.0.0.1.:8787            末尾ドット
 *   https://2130706433                 10進表記の 127.0.0.1
 *
 * 弾く形を列挙し続けるより、通す形を列挙するほうが漏れない。
 * 接続先を増やすときはここに追加する。
 */
const ALLOWED_RELEASE_ORIGINS: readonly string[] = [PRODUCTION_API_URL];

/**
 * URL から `scheme://host[:port]` を取り出す。判定できなければ null。
 * userinfo（`user@`）は捨て、実際の接続先ホストだけを見る。
 *
 * React Native の URL 実装は環境によって挙動が異なるため、
 * new URL() には頼らず自前で切り出す。
 */
function normalizeOrigin(url: string): string | null {
  const match = url.match(/^(https?):\/\/([^/?#]*)/i);
  if (!match) return null;

  const scheme = match[1].toLowerCase();
  let authority = match[2];

  // `user:pass@host` の形では @ より後ろが接続先
  const at = authority.lastIndexOf('@');
  if (at !== -1) authority = authority.slice(at + 1);

  if (!authority) return null;

  // 末尾ドット（`example.com.`）は同じホストを指すので落とす
  authority = authority.toLowerCase().replace(/\.(?=$|:)/, '');

  return `${scheme}://${authority}`;
}

/**
 * 開発機・ローカルネットワーク向けのURLかどうか。
 * 警告文をわかりやすくするための補助判定で、遮断そのものは
 * ALLOWED_RELEASE_ORIGINS の照合で行う。
 */
function isLocalNetworkUrl(url: string): boolean {
  const origin = normalizeOrigin(url);
  if (!origin) return false;

  // ポートと IPv6 の角括弧を外してホストだけにする
  const host = origin.replace(/^https?:\/\//, '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (host === '::1' || host.startsWith('fe80:')) return true; // IPv6 ループバック / リンクローカル

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return false;

  const [a, b] = octets;
  return (
    a === 127 ||                          // ループバック
    a === 10 ||                           // プライベート
    (a === 172 && b >= 16 && b <= 31) ||  // プライベート
    (a === 192 && b === 168) ||           // プライベート
    (a === 100 && b >= 64 && b <= 127)    // CGNAT（Tailscale）
  );
}

/**
 * 実際に使うバックエンドURLを返す。
 * 配布ビルドでは許可した本番オリジン以外を採用しない（fail closed）。
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;

  if (__DEV__) {
    return configured ?? DEV_FALLBACK_API_URL;
  }

  if (!configured) return PRODUCTION_API_URL;

  const origin = normalizeOrigin(configured);

  if (!origin || !ALLOWED_RELEASE_ORIGINS.includes(origin)) {
    const reason = isLocalNetworkUrl(configured) ? '開発用のURL' : '許可していないオリジン';
    console.warn(`[api] 配布ビルドで${reason}が指定されているため、本番URLを使います`);
    return PRODUCTION_API_URL;
  }

  return configured;
}

/** バックエンドのベースURL（アプリ全体でこの値を使う） */
export const API_BASE_URL = resolveApiBaseUrl();
