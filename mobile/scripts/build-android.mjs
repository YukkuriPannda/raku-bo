#!/usr/bin/env node
// ============================================================
// scripts/build-android.mjs
// EAS を使わずローカルで Android APK をビルドする
//
//   npm run build:android          リリースAPK（配布用・本番バックエンド）
//   npm run build:android -- --debug   デバッグAPK（Metro必須・開発用）
//   npm run build:android -- --clean   android/ を作り直してからビルド
//   npm run build:android -- --no-upload  GitHub Releaseを作らない
//
// EAS の `--local` は Windows 非対応のため、prebuild + Gradle を直接叩く。
// PATH 上の java が古くても動くよう、JDK と Android SDK は自前で探す。
// できあがったAPKは GitHub Releases（タグ `v<mobile/app.json の expo.version>`）
// に下書き（draft）として上げる。本人が説明文を確認して GitHub 上で
// publish するまでは外部には見えない（public リポジトリなので、publish後は
// スマホから認証なしで直接ダウンロードできる）。
// ============================================================

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const projectRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const isDebug = args.includes('--debug');
const isClean = args.includes('--clean');
const skipUpload = args.includes('--no-upload');

// ------------------------------------------------------------
// 署名用の環境変数をリポジトリ外のファイルから読む
//
// 毎回シェルで export するのが面倒なので、キーストアと同じ場所に
// 置いたファイルから読めるようにする。既定は次の場所:
//   ~/.rakubo/signing.env    （RAKUBO_SIGNING_ENV で変更可）
//
// 書式は 1行1件の KEY=VALUE。# 始まりとカラ行は無視する。
//
//   RAKUBO_KEYSTORE_PATH=C:\Users\<user>\.rakubo\rakubo-release.jks
//   RAKUBO_KEYSTORE_PASSWORD=<ストアのパスワード>
//   RAKUBO_KEY_ALIAS=rakubo
//   RAKUBO_KEY_PASSWORD=<鍵のパスワード>
//
// mobile/.env には書かないこと。あちらは docker-compose の env_file で
// コンテナへ丸ごと渡るため、署名パスワードがコンテナ環境から見える
// 状態になる。加えて .env はリポジトリの中にあり、gitignore していても
// `git add -f` や同期ツール経由で外に出る余地が残る。キーストア本体を
// リポジトリ外に置いているのと同じ理由で、パスワードも外に置く。
//
// 読み込むのは RAKUBO_ で始まるキーだけ。任意の環境変数を注入できる
// 抜け道にはしない。既にプロセスに設定済みの値は上書きしない
// （その場のシェルでの指定を優先する）。
// ------------------------------------------------------------
function loadSigningEnvFile() {
  const envPath =
    process.env.RAKUBO_SIGNING_ENV || path.join(os.homedir(), '.rakubo', 'signing.env');

  if (!existsSync(envPath)) return;

  const loaded = [];
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key.startsWith('RAKUBO_')) continue;

    // 値の前後の引用符だけ外す（パスワードに記号が入っていても壊さない）
    const value = line.slice(eq + 1).trim().replace(/^(['"])([\s\S]*)\1$/, '$2');

    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded.push(key);
    }
  }

  if (loaded.length > 0) {
    // 値は出さない。キー名だけ
    console.log(`署名設定を読み込みました: ${envPath} (${loaded.join(', ')})`);
  }
}

loadSigningEnvFile();

// 配布ビルドの接続先。開発機（.env の Tailscale/LAN アドレス）を
// 焼き込まないよう、リリース時は明示的に本番URLを渡す。
// constants/api.ts 側にも実行時ガードがあるが、そもそもバンドルに
// 開発機のURLを入れないためにここで上書きする。
const PRODUCTION_API_URL = 'https://raku-bo-backend.funa-hayate.workers.dev';

// ------------------------------------------------------------
// リリース署名
//
// expo prebuild が生成する android/app/build.gradle は、React Native の
// テンプレートのまま release を signingConfigs.debug で署名する
// （テンプレート自身が "Caution! In production, you need to generate
// your own keystore file." と警告している）。
//
// その debug.keystore は RN テンプレート同梱の公開鍵で、秘密鍵は
// react-native リポジトリで誰でも入手できる。つまりリリースAPKを
// そのまま配ると、第三者が同じ鍵で署名した偽アプリを「更新」として
// インストールでき、アプリの識別情報・プライベート領域・Keystore に
// 紐づく SecureStore の中身（Google リフレッシュトークン、Supabase
// セッション）をそのまま引き継がれてしまう。
//
// そのため release では独自キーストアを必須とし、環境変数で受け取る。
// 値をディスクに書かず、gradle の build.gradle 側で System.getenv() から
// 読ませる（プロセス一覧に載る -P 渡しも避ける）。
// ------------------------------------------------------------
const KEYSTORE_ENV_VARS = [
  'RAKUBO_KEYSTORE_PATH',
  'RAKUBO_KEYSTORE_PASSWORD',
  'RAKUBO_KEY_ALIAS',
  'RAKUBO_KEY_PASSWORD',
];

/** RN テンプレート同梱 debug.keystore の SHA-256（これで署名されていたら失敗させる） */
const RN_DEBUG_KEY_SHA256 =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

function requireReleaseKeystore() {
  const missing = KEYSTORE_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length === 0) {
    if (!existsSync(process.env.RAKUBO_KEYSTORE_PATH)) {
      fail(`キーストアが見つかりません: ${process.env.RAKUBO_KEYSTORE_PATH}`);
    }
    return;
  }

  fail(
    `リリースビルドには独自の署名鍵が必要です。未設定: ${missing.join(', ')}\n\n` +
      '  そのままビルドすると RN テンプレート同梱の公開デバッグ鍵で署名され、\n' +
      '  第三者が同じ鍵で署名した偽アプリを「更新」として入れられる状態になります。\n\n' +
      '  1) キーストアを作る（リポジトリ外に置き、必ずバックアップする。\n' +
      '     失くすとアプリを更新できなくなります）:\n' +
      '     keytool -genkeypair -v -keystore rakubo-release.jks \\\n' +
      '       -alias rakubo -keyalg RSA -keysize 4096 -validity 10000\n\n' +
      '  2) 次のどちらかで渡してから再実行:\n\n' +
      `     a) ファイルに置く（毎回の入力が不要。推奨）\n` +
      `        ${path.join(os.homedir(), '.rakubo', 'signing.env')}\n` +
      '        RAKUBO_KEYSTORE_PATH=<jksの絶対パス>\n' +
      '        RAKUBO_KEYSTORE_PASSWORD=<ストアのパスワード>\n' +
      '        RAKUBO_KEY_ALIAS=rakubo\n' +
      '        RAKUBO_KEY_PASSWORD=<鍵のパスワード>\n\n' +
      '        置き場所は RAKUBO_SIGNING_ENV で変更できます。\n' +
      '        mobile/.env には書かないこと（docker-compose がコンテナへ\n' +
      '        丸ごと渡すため、パスワードがコンテナ環境から見えてしまう）。\n\n' +
      '     b) その場のシェルで環境変数として設定する\n' +
      '        （ファイルの値より優先されます）\n\n' +
      '  デバッグAPK（--debug）にはこの制限はかかりません。',
  );
}

/**
 * prebuild が生成した build.gradle に release 用の署名設定を注入する。
 * prebuild は build.gradle を作り直すため、毎回このパッチを当て直す必要がある
 * （package.json の scripts を戻しているのと同じ理由）。冪等に動く。
 */
function patchReleaseSigning(androidDir) {
  const gradlePath = path.join(androidDir, 'app', 'build.gradle');
  let gradle = readFileSync(gradlePath, 'utf8');

  if (gradle.includes('RAKUBO_KEYSTORE_PATH')) return; // 既に適用済み

  // Gradle は signingConfigs を「設定フェーズ」で評価するため、
  // assembleDebug でもこのブロックが実行される。素朴に
  // file(System.getenv(...)) と書くと、鍵の環境変数が無い環境では
  // file(null) となって "Cannot convert 'null' to File." で
  // デバッグビルドまで落ちる（--debug は鍵不要のはずなのに使えない）。
  // そのため未設定時は何も設定しないようガードする。
  //
  // これでリリースが無署名で通ることはない:
  //   - requireReleaseKeystore() が Gradle 起動前に4変数を必須化する
  //   - ビルド後に apksigner で署名者を検証し、デバッグ鍵なら失敗させる
  const releaseSigningConfig = `        release {
            if (System.getenv("RAKUBO_KEYSTORE_PATH") != null) {
                storeFile file(System.getenv("RAKUBO_KEYSTORE_PATH"))
                storePassword System.getenv("RAKUBO_KEYSTORE_PASSWORD")
                keyAlias System.getenv("RAKUBO_KEY_ALIAS")
                keyPassword System.getenv("RAKUBO_KEY_PASSWORD")
            }
        }
`;

  // 対応する閉じ括弧の位置を返す（openAt は '{' の位置）
  const matchingBrace = (text, openAt) => {
    let depth = 0;
    for (let i = openAt; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) return i;
    }
    return -1;
  };

  // --- 手順1: buildTypes.release の signingConfig を先に差し替える ---
  //
  // 正規表現で 'release {' を探すと、あとで signingConfigs 内に足す
  // release ブロックにも一致してしまい、buildTypes.debug 側を
  // 誤って書き換える。ブロックの範囲を括弧対応で特定して、
  // buildTypes.release の内側だけを書き換える。
  const buildTypesAt = gradle.indexOf('buildTypes {');
  if (buildTypesAt === -1) fail('build.gradle の buildTypes を認識できませんでした');

  const releaseAt = gradle.indexOf('release {', buildTypesAt);
  if (releaseAt === -1) fail('build.gradle の buildTypes.release を認識できませんでした');

  const releaseEnd = matchingBrace(gradle, gradle.indexOf('{', releaseAt));
  const DEBUG_REF = 'signingConfig signingConfigs.debug';
  const debugRefAt = gradle.indexOf(DEBUG_REF, releaseAt);
  if (debugRefAt === -1 || releaseEnd === -1 || debugRefAt > releaseEnd) {
    fail('buildTypes.release 内の signingConfig を特定できませんでした');
  }

  gradle =
    gradle.slice(0, debugRefAt) +
    'signingConfig signingConfigs.release' +
    gradle.slice(debugRefAt + DEBUG_REF.length);

  // --- 手順2: signingConfigs に release を足す ---
  // signingConfigs は buildTypes より前にあるため、手順1のあとに挿入しても
  // 手順1で使った位置は影響を受けない
  const signingConfigsAt = gradle.indexOf('signingConfigs {');
  if (signingConfigsAt === -1) fail('build.gradle の signingConfigs を認識できませんでした');
  const signingConfigsEnd = matchingBrace(gradle, gradle.indexOf('{', signingConfigsAt));
  if (signingConfigsEnd === -1) fail('signingConfigs の範囲を特定できませんでした');

  gradle = `${gradle.slice(0, signingConfigsEnd)}${releaseSigningConfig}${gradle.slice(signingConfigsEnd)}`;

  writeFileSync(gradlePath, gradle);
  console.log('（build.gradle に release 用の署名設定を注入しました）');
}

/**
 * できあがったAPKの署名者を確認し、公開デバッグ鍵で署名されていたら失敗させる。
 * 設定ミスで気付かないまま配布するのを防ぐ最後の関門。
 */
function assertNotDebugSigned(apkPath, androidHome) {
  const buildToolsRoot = path.join(androidHome, 'build-tools');
  if (!existsSync(buildToolsRoot)) {
    console.log('! build-tools が見つからず署名を検証できませんでした（手動で確認してください）');
    return;
  }
  const version = readdirSync(buildToolsRoot).sort().reverse()[0];
  const apksigner = path.join(buildToolsRoot, version, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
  if (!existsSync(apksigner)) {
    console.log('! apksigner が見つからず署名を検証できませんでした（手動で確認してください）');
    return;
  }

  const result = spawnSync(apksigner, ['verify', '--print-certs', apkPath], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const normalized = output.replace(/\s/g, '').toUpperCase();

  if (normalized.includes(RN_DEBUG_KEY_SHA256.replace(/:/g, ''))) {
    fail(
      'このAPKは RN テンプレート同梱の公開デバッグ鍵で署名されています。配布してはいけません。\n' +
        '  署名設定の注入が効いていない可能性があります。--clean を付けて作り直してください。',
    );
  }

  const fingerprint = output.match(/SHA-256 digest:\s*([0-9a-f]+)/i)?.[1];
  console.log(`✓ 署名を確認（デバッグ鍵ではありません）${fingerprint ? ` SHA-256: ${fingerprint.slice(0, 16)}…` : ''}`);
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  // Windows では npx / gradlew.bat をシェル経由でしか起動できない。
  // シェル利用時に引数配列を渡すと Node が警告を出すため、1本の文字列にまとめる
  // （引数はこのスクリプト内の固定値のみで、外部入力は含まれない）。
  //
  // この結合はクォートをしないため、値に空白が入ると引数の区切りとして壊れる。
  // tag（app.json 由来）や apkPath（ファイルシステム由来）のような外部由来の
  // 値を渡す必要がある呼び出し（gh release create など）はこの関数を経由せず、
  // shell 無しの spawnSync に配列のまま渡すこと（Node がエスケープしてくれる）。
  const useShell = process.platform === 'win32';
  const result = useShell
    ? spawnSync([command, ...commandArgs].join(' '), {
        stdio: 'inherit',
        shell: true,
        cwd: projectRoot,
        ...options,
      })
    : spawnSync(command, commandArgs, {
        stdio: 'inherit',
        cwd: projectRoot,
        ...options,
      });
  if (result.status !== 0) {
    fail(`コマンドが失敗しました: ${command} ${commandArgs.join(' ')}`);
  }
}

// ------------------------------------------------------------
// JDK 17以上を探す（Gradle が要求する）
// ------------------------------------------------------------
function javaMajorVersion(javaHome) {
  const javaBin = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!existsSync(javaBin)) return null;

  const result = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const match = output.match(/version "(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  const major = Number(match[1]);
  // 1.8 形式の古い表記
  return major === 1 ? Number(match[2]) : major;
}

function resolveJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    // Android Studio 同梱の JetBrains Runtime
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Android Studio', 'jbr'),
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/usr/lib/jvm/java-17-openjdk-amd64',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const version = javaMajorVersion(candidate);
    if (version !== null && version >= 17) return candidate;
  }

  fail(
    'JDK 17以上が見つかりませんでした。Android Studio を入れるか、JAVA_HOME に JDK 17+ を設定してください。',
  );
}

// ------------------------------------------------------------
// Android SDK を探す
// ------------------------------------------------------------
function resolveAndroidHome() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'platform-tools'))) return candidate;
  }

  fail(
    'Android SDK が見つかりませんでした。Android Studio の SDK Manager で導入するか、ANDROID_HOME を設定してください。',
  );
}

// ------------------------------------------------------------
// GitHub Release の事前確認・作成
//
// 配布経路は GitHub Releases に一本化している（Googleドライブは廃止）。
// リポジトリが public なので、認証なしでスマホから直接APKを
// ダウンロードできる。
//
// 本人が公開前に説明文（--generate-notes の自動生成テキスト）を
// 確認したいため、--draft で作成する。draft は GitHub 上で
// 「Publish release」を押すまで外部には見えない（APKも添付済みだが、
// 公開ボタンを押すまではダウンロードできない）。
//
// バージョンは mobile/app.json の expo.version を正とし、タグは
// `v<version>`（例 v1.0.0）にする。タグはリリースのたびに変わる必要が
// あるため、version を上げ忘れると既存タグと衝突する。ここで黙って
// 上書きしたり別名にしたりはせず、必ず気づける形で止める。
//
// 【落とし穴】draft は publish するまで git のタグを作らない。
// そのため tagExistsOnRemote()（git のタグの有無）だけで衝突判定すると:
//   1) v1.0.1 でビルド → draft ができる（タグはまだ無い）
//   2) publish し忘れたまま、もう一度 v1.0.1 でビルド
//   3) タグが無いので衝突チェックを素通りし、同じバージョンの draft が
//      2つできてしまう
// という事故を確実に踏む。タグ（tagExistsOnRemote）と、gh が使える場合は
// 既存リリース自体（findExistingRelease。gh release view はタグ名で
// draft も引けるため、publish前でも見つかる）の両方で確認すること。
// gh が無い/未認証のときは draft の重複は検出できない（タグだけの判定に
// 落とし、その旨を警告する。ビルド自体は止めない）。
//
// 【重要】前提確認（バージョン取得・タグ衝突・draft重複・push状況・
// gh可用性）は必ず gradle のビルドより前に行うこと（preflightRelease()）。
// ビルドは10〜20分かかる。CLAUDE.md には「version上げ忘れはタグ衝突で
// 気づく」と明記しており、上げ忘れは実際に起きる前提になっている。この
// 確認をビルド後に回すと、20分待たされたあげく失敗して丸ごと無駄になり、
// 「気づける形で止める」という設計の意味が薄れる。
// ------------------------------------------------------------

/** リモートに指定タグが既に存在するか（gh を経由せず git だけで判定できるようにする） */
function tagExistsOnRemote(tag) {
  const result = spawnSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

/**
 * 指定タグ宛ての GitHub Release が既に存在するか（draft も含む）。
 *
 * draft は publish するまで git のタグを作らないため、tagExistsOnRemote()
 * のようなタグベースの判定では検出できない。`gh release view <tag>` は
 * タグ名で「そのタグを使う予定のリリース」を引けるので、draft・公開済み
 * のどちらも見つけられる（`gh release view --help` の JSON FIELDS に
 * isDraft があることを確認済み。`gh release list` も既定で draft を含む
 * ―― --exclude-drafts というオプトアウト用フラグが存在することから
 * 確認できる）。
 *
 * gh が使える場合にのみ呼ぶこと（呼び出し側の isGhReady() 判定に依存する。
 * gh が無い環境で呼ぶと ENOENT で落ちる）。
 */
function findExistingRelease(tag) {
  const result = spawnSync('gh', ['release', 'view', tag, '--json', 'isDraft,url'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    // タグに紐づくリリースが無い場合も gh は非0で終了する
    // （実機で `gh release view <存在しないtag>` → "release not found" / exit 1 を確認済み）。
    // ここでは「見つからなければ衝突なし」として扱えば十分。
    return { exists: false, isDraft: false, url: null };
  }
  try {
    const data = JSON.parse(result.stdout);
    return { exists: true, isDraft: Boolean(data.isDraft), url: data.url ?? null };
  } catch {
    // JSON が壊れていた場合も安全側（衝突なし扱い）に倒す。
    // 注意: GitHub は同じタグ名の draft を複数作れてしまう
    // （gh release create 自体はタグ重複を理由には弾かない）ため、
    // ここでの見逃しに対する安全網は無い。パース失敗時のログは
    // 目視で確認できるよう console.error 等に残すことを検討してもよいが、
    // 頻度が低い想定のため今は「見逃す」側に倒している。
    return { exists: false, isDraft: false, url: null };
  }
}

/**
 * HEAD がリモートの現在のブランチに push 済みであることを確認する。
 * GitHub Release はリモート上のコミットにタグを打つため、未pushのコミットで
 * 作ると「APKの中身」と「リリースが指すコード」がズレる。
 */
function ensurePushed(headSha) {
  const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const branch = branchResult.stdout.trim();
  if (branchResult.status !== 0 || !branch || branch === 'HEAD') {
    fail('現在 detached HEAD のため push状況を確認できませんでした。ブランチをチェックアウトしてから実行してください。');
  }

  const remoteResult = spawnSync('git', ['ls-remote', 'origin', branch], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const remoteSha = remoteResult.stdout.trim().split(/\s+/)[0];

  if (!remoteSha) {
    fail(`リモートに ${branch} ブランチが見つかりません。先に push してください:\n\n    git push -u origin ${branch}`);
  }
  if (remoteSha !== headSha) {
    fail(
      `HEAD (${headSha.slice(0, 7)}) がリモートの ${branch} (${remoteSha.slice(0, 7)}) と一致しません。\n` +
        '  GitHub Release はリモート上のコミットにタグを打つため、未pushのコミットで作ると\n' +
        '  「APKの中身」と「リリースが指すコード」がズレます。先に push してください:\n\n' +
        `    git push origin ${branch}`,
    );
  }
}

/**
 * gh コマンドが使え、かつ認証済みか。
 * gh は git と同じくネイティブの実行ファイルなので、gradlew や npx と違い
 * シェル経由（shell: true）にしなくても Windows で直接起動できる
 * （shell: true と引数配列を併用すると Node が非エスケープを警告するため避ける）。
 */
function isGhReady() {
  const version = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (version.error || version.status !== 0) return false;
  const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return auth.status === 0;
}

/**
 * リリース前提の確認を gradle 起動前にまとめて行う（fail-fast）。
 * ここで検出した問題（タグ衝突・未push）は gradle を1秒も動かす前に止める。
 *
 * gh の可用性チェックもここで1回だけ行う。無ければビルド前に警告するが、
 * 挙動は変えない＝ gh が無い/未認証でもビルド自体は止めない（fail させない）。
 * ビルド後に isGhReady() を呼び直す必要はない（結果をそのまま使い回す）。
 *
 * --debug / --no-upload のときはそもそもリリースしないため、確認ごとスキップする。
 *
 * @returns {{tag: string, headSha: string, ghReady: boolean} | null} スキップ時は null
 */
function preflightRelease() {
  if (isDebug) {
    console.log('\n（--debug ビルドのため GitHub Release は作成しません）');
    return null;
  }
  if (skipUpload) {
    console.log('\n（--no-upload のため GitHub Release の作成をスキップします）');
    return null;
  }

  const appJsonPath = path.join(projectRoot, 'app.json');
  if (!existsSync(appJsonPath)) fail(`mobile/app.json が見つかりません: ${appJsonPath}`);

  let version;
  try {
    version = JSON.parse(readFileSync(appJsonPath, 'utf8'))?.expo?.version;
  } catch (err) {
    fail(`mobile/app.json の読み込みに失敗しました: ${err.message}`);
  }
  if (!version) fail('mobile/app.json に expo.version が見つかりませんでした。');

  const tag = `v${version}`;

  console.log('\n--- GitHub Release の事前確認（ビルド前）---');
  console.log(`  バージョン : ${version}（タグ: ${tag}）`);

  // 判定その1: タグ（gh が無くてもここまでは確認できる）
  if (tagExistsOnRemote(tag)) {
    fail(
      `タグ ${tag} は既にリリース済みです。\n\n` +
        `  mobile/app.json の expo.version を上げてください（現在 ${version}、タグ ${tag} は既出）。\n` +
        '  上げたらコミット・pushしてから、もう一度ビルドしてください。',
    );
  }

  const headSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).stdout.trim();
  ensurePushed(headSha);

  const ghReady = isGhReady();

  if (ghReady) {
    // 判定その2: 既存リリース本体（draft も含む）。タグが無いだけでは
    // publish待ちの draft を見逃す（このファイル冒頭の「落とし穴」参照）。
    const existing = findExistingRelease(tag);
    if (existing.exists) {
      // tagExistsOnRemote() で公開済みは既に弾いているので、ここに来るのは
      // 基本的に draft が残っているケース（念のため isDraft で分岐する）。
      if (existing.isDraft) {
        fail(
          `タグ ${tag} 宛ての GitHub Release が既に存在します（下書き・未公開）。\n\n` +
            (existing.url ? `  ${existing.url}\n\n` : '') +
            '  draft は publish するまで git タグを作らないため、タグの有無だけでは\n' +
            '  重複を検出できません。GitHub で publish するか、その draft を\n' +
            '  削除してから、もう一度ビルドしてください。',
        );
      }
      fail(
        `タグ ${tag} 宛ての GitHub Release が既に存在します（公開済み）。\n\n` +
          (existing.url ? `  ${existing.url}\n\n` : '') +
          `  mobile/app.json の expo.version を上げてください（現在 ${version}、タグ ${tag} は既出）。\n` +
          '  上げたらコミット・pushしてから、もう一度ビルドしてください。',
      );
    }
    console.log(`✓ タグ・draftの重複とも問題なし。ビルド完了後に ${tag} として draft を作成します。`);
  } else {
    // gh が無い／未認証でも、ビルド自体は成功しているので fail させず警告に留める。
    // ただし draft の重複は gh 経由でしか検出できないため、ここでは検出できない
    // （タグだけの判定に落ちている）ことも明示しておく。
    console.log('\n! gh コマンドが使えないか未認証です。ビルド完了後、GitHub Release の作成はスキップされます。');
    console.log('  gh が無いため、publishし忘れの draft との重複はここでは検出できません。');
    console.log('  完了後、以下を手動で実行してください（<APKのパス> は実際の成果物に差し替える）:\n');
    console.log(
      `    gh release create ${tag} <APKのパス> --draft --title ${tag} --generate-notes --target ${headSha}\n`,
    );
  }

  return { tag, headSha, ghReady };
}

/**
 * gh release create を直接 spawnSync で叩く（run() は経由しない）。
 *
 * run() は Windows で npx / gradlew.bat のようなバッチファイルを起動する
 * ため、引数配列を1本の文字列に結合してシェル経由で実行している。この
 * 結合はクォートをしないため、値に空白が入ると引数の区切りとして壊れる
 * （今のリポジトリの置き場所には空白が無いが、保証はできない）。
 * gh.exe はネイティブの実行ファイルで shell 無しでも直接起動できるので、
 * tag（app.json 由来）や apkPath（ファイルシステム由来）のような外部由来の
 * 値を渡すこの呼び出しは、配列のまま spawnSync に渡す
 * （Node がプラットフォームごとに正しくエスケープしてくれる）。
 *
 * --draft を付けて下書きとして作成する。本人が説明文（--generate-notes の
 * 自動生成テキスト）を確認してから GitHub 上で publish する運用のため、
 * ここで自動的に公開まではしない。stdio: 'inherit' なので、gh が標準出力に
 * 出す作成済みリリースのURL（draftのURL）はそのまま画面に出る。
 */
function runGhReleaseCreate(tag, apkPath, headSha) {
  const result = spawnSync(
    'gh',
    ['release', 'create', tag, apkPath, '--draft', '--title', tag, '--generate-notes', '--target', headSha],
    { stdio: 'inherit', cwd: projectRoot },
  );
  if (result.status !== 0) {
    fail(`GitHub Release（draft）の作成に失敗しました: gh release create ${tag}`);
  }
}

// ------------------------------------------------------------
// ビルド
// ------------------------------------------------------------
// リリースは独自の署名鍵が揃っていないと先に進ませない（ビルド前に検査する）
if (!isDebug) {
  requireReleaseKeystore();
}

// GitHub Release の前提確認もビルド前に済ませる（理由は上のコメント参照）。
// 戻り値はビルド完了後、実際の gh release create 呼び出しで使う。
const release = preflightRelease();

const javaHome = resolveJavaHome();
const androidHome = resolveAndroidHome();

console.log(`JDK         : ${javaHome} (Java ${javaMajorVersion(javaHome)})`);
console.log(`Android SDK : ${androidHome}`);
console.log(`ビルド種別   : ${isDebug ? 'debug' : 'release'}\n`);

const buildEnv = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
};

// リリースは常に本番バックエンドを向かせる（.env の値より優先される）
if (!isDebug) {
  buildEnv.EXPO_PUBLIC_API_URL = PRODUCTION_API_URL;
}

const androidDir = path.join(projectRoot, 'android');
if (isClean || !existsSync(androidDir)) {
  console.log('--- expo prebuild ---');

  // prebuild は package.json の android/ios スクリプトを expo run:* に
  // 書き換えてしまう。開発は Expo Go（expo start）で回しているので、
  // ビルドの副作用で開発手順が変わらないよう元に戻す。
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const scriptsBefore = JSON.parse(readFileSync(packageJsonPath, 'utf8')).scripts;

  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install', ...(isClean ? ['--clean'] : [])], {
    env: buildEnv,
  });

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (JSON.stringify(packageJson.scripts) !== JSON.stringify(scriptsBefore)) {
    packageJson.scripts = scriptsBefore;
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    console.log('（prebuild が書き換えた package.json の scripts を元に戻しました）');
  }
}

// prebuild は build.gradle を作り直すため、既存の android/ を使う場合も含めて
// 毎回パッチを当て直す（適用済みなら何もしない）
if (!isDebug) {
  patchReleaseSigning(androidDir);
}

console.log('\n--- gradle ---');
// カレントディレクトリを明示する（'gradlew.bat' だけだと解決できない環境がある）。
// 環境変数 NoDefaultCurrentDirectoryInExePath=1 が設定されていると cmd.exe は
// 実行ファイルの探索にカレントディレクトリを含めないため、
// 「'gradlew.bat' は、内部コマンドまたは外部コマンド……として認識されていません」
// で失敗する。POSIX 側と同じく先頭にカレントディレクトリを付ける。
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const task = isDebug ? 'assembleDebug' : 'assembleRelease';
run(gradlew, [task], { cwd: androidDir, env: buildEnv });

// ------------------------------------------------------------
// 成果物を build/ に取り出す
// ------------------------------------------------------------
const outputDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', isDebug ? 'debug' : 'release');
const apk = readdirSync(outputDir).find((file) => file.endsWith('.apk'));
if (!apk) fail(`APK が見つかりません: ${outputDir}`);

const distDir = path.join(projectRoot, 'build');
mkdirSync(distDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const destination = path.join(distDir, `rakubo-${isDebug ? 'debug' : 'release'}-${stamp}.apk`);
copyFileSync(path.join(outputDir, apk), destination);

// 配布前の最後の関門。デバッグ鍵で署名されていたらここで止める
if (!isDebug) {
  assertNotDebugSigned(destination, androidHome);
}

console.log(`\n✓ 完成: ${destination}`);
console.log('  端末にインストール: adb install -r "' + destination + '"');

// ------------------------------------------------------------
// GitHub Release（draft）の作成
//
// 前提確認（バージョン取得・タグ衝突・draft重複・push状況・gh可用性）は
// ビルド前の preflightRelease() で済ませてある（このファイル前半、
// "ビルド" セクション直前を参照）。ここでは確認済みの release オブジェクト
// を使って、実際に gh release create --draft を叩くだけ。
// ------------------------------------------------------------
if (release) {
  console.log('\n--- GitHub Release ---');
  if (release.ghReady) {
    console.log(`  添付するAPK: ${destination}`);
    console.log('  下書き（draft）として作成します。公開はされません。');
    runGhReleaseCreate(release.tag, destination, release.headSha);
    console.log(
      '\n✓ draft を作成しました（上に出たURLから開けます）。説明文を確認し、\n' +
        '  問題なければ GitHub 上の「Publish release」で公開してください。\n' +
        '  publish するまでスマホからはダウンロードできません。',
    );
  } else {
    // gh の可用性はビルド前に警告済み。ここでは実際のAPKパス入りの
    // コマンドを改めて案内するだけで、isGhReady() は呼び直さない。
    console.log('  gh が使えないため作成をスキップしました。以下を手動で実行してください:\n');
    console.log(
      `    gh release create ${release.tag} "${destination}" --draft --title ${release.tag} --generate-notes --target ${release.headSha}\n`,
    );
  }
}
