// ============================================================
// lib/crypto-polyfill.ts
// crypto.subtle.digest を expo-crypto で補う
//
// supabase-js は PKCE の code_challenge を作るとき、次の3つが揃って
// いなければ SHA-256 をあきらめて「plain」にフォールバックする
// （@supabase/auth-js の generatePKCEChallenge）:
//
//   typeof crypto !== 'undefined' &&
//   typeof crypto.subtle !== 'undefined' &&
//   typeof TextEncoder !== 'undefined'
//
// React Native では crypto.subtle が無いため、実機ログで
//   WebCrypto API is not supported.
//   Code challenge method will default to use plain instead of sha256.
// が出て、認可URLが code_challenge_method=plain になっていた。
// plain は code_challenge に code_verifier をそのまま載せる方式なので、
// lib/auth.ts のコメントが前提にしている PKCE の強度に達しない。
//
// TextEncoder は Hermes が持っている（expo/src/winter/TextDecoder.ts の
// コメントにも「TextEncoder is in Hermes」とある）ので、
// 足りないのは crypto.subtle だけ。そこだけを埋める。
//
// 方針:
//   - 既にあるものは絶対に置き換えない（他のライブラリの実装を壊さない）
//   - digest 以外は実装しない。必要になったら足す
// ============================================================

import * as Crypto from 'expo-crypto';

/** WebCrypto のアルゴリズム名を expo-crypto の列挙へ対応させる */
const DIGEST_ALGORITHMS: Record<string, Crypto.CryptoDigestAlgorithm> = {
  'sha-1': Crypto.CryptoDigestAlgorithm.SHA1,
  'sha-256': Crypto.CryptoDigestAlgorithm.SHA256,
  'sha-384': Crypto.CryptoDigestAlgorithm.SHA384,
  'sha-512': Crypto.CryptoDigestAlgorithm.SHA512,
};

/**
 * WebCrypto の digest は algorithm を文字列でも
 * `{ name: 'SHA-256' }` でも受け取るため、両方に対応する。
 */
function resolveAlgorithm(algorithm: unknown): Crypto.CryptoDigestAlgorithm {
  const name =
    typeof algorithm === 'string'
      ? algorithm
      : typeof algorithm === 'object' && algorithm !== null && 'name' in algorithm
        ? String((algorithm as { name: unknown }).name)
        : '';

  const resolved = DIGEST_ALGORITHMS[name.toLowerCase()];
  if (!resolved) {
    throw new Error(`crypto.subtle.digest: 未対応のアルゴリズムです: ${name || String(algorithm)}`);
  }
  return resolved;
}

const globalScope = globalThis as typeof globalThis & {
  crypto?: Crypto_ & Record<string, unknown>;
};
type Crypto_ = { subtle?: { digest?: unknown } };

// crypto そのものが無い環境では器だけ用意する
if (typeof globalScope.crypto === 'undefined') {
  Object.defineProperty(globalScope, 'crypto', {
    value: {},
    configurable: true,
    writable: true,
  });
}

const cryptoObject = globalScope.crypto!;

if (typeof cryptoObject.subtle === 'undefined') {
  Object.defineProperty(cryptoObject, 'subtle', {
    value: {},
    configurable: true,
    writable: true,
  });
}

// 既に digest があるなら触らない（将来 RN 側が実装した場合はそちらを使う）
if (typeof cryptoObject.subtle!.digest !== 'function') {
  Object.defineProperty(cryptoObject.subtle!, 'digest', {
    value: async (algorithm: unknown, data: BufferSource): Promise<ArrayBuffer> => {
      // expo-crypto の digest は ArrayBuffer を返す。
      // supabase-js 側は new Uint8Array(hash) で読むため、そのまま渡せる
      return Crypto.digest(resolveAlgorithm(algorithm), data);
    },
    configurable: true,
    writable: true,
  });
}
