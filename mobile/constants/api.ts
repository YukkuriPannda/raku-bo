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
 * 開発機・ローカルネットワーク向けのURLかどうか。
 * loopback / プライベートIP / Tailscale(CGNAT 100.64.0.0-100.127.255.255) /
 * .local を対象にする。
 */
function isLocalNetworkUrl(url: string): boolean {
  const host = url.replace(/^https?:\/\//, '').split(/[:/]/)[0].toLowerCase();

  if (host === 'localhost' || host.endsWith('.local')) return true;

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
 * リリースビルドでは https 以外・ローカルネットワーク宛てを弾く。
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;

  if (__DEV__) {
    return configured ?? DEV_FALLBACK_API_URL;
  }

  if (!configured) return PRODUCTION_API_URL;

  if (!configured.startsWith('https://') || isLocalNetworkUrl(configured)) {
    console.warn(
      `[api] 配布ビルドで開発用のURL(${configured})が指定されているため、本番URLを使います`,
    );
    return PRODUCTION_API_URL;
  }

  return configured;
}

/** バックエンドのベースURL（アプリ全体でこの値を使う） */
export const API_BASE_URL = resolveApiBaseUrl();
