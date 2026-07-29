#!/usr/bin/env node
// ============================================================
// scripts/build-android.mjs
// EAS を使わずローカルで Android APK をビルドする
//
//   npm run build:android          リリースAPK（配布用・本番バックエンド）
//   npm run build:android -- --debug   デバッグAPK（Metro必須・開発用）
//   npm run build:android -- --clean   android/ を作り直してからビルド
//   npm run build:android -- --no-upload  Googleドライブへのコピーをしない
//
// EAS の `--local` は Windows 非対応のため、prebuild + Gradle を直接叩く。
// PATH 上の java が古くても動くよう、JDK と Android SDK は自前で探す。
// できあがったAPKは Google ドライブ（デスクトップ版のマウント先）にも
// 置いて、スマホから直接ダウンロードできるようにする。
// ============================================================

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const projectRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const isDebug = args.includes('--debug');
const isClean = args.includes('--clean');
const skipUpload = args.includes('--no-upload');

// Google ドライブ内の保存先。RAKUBO_DRIVE_DIR で上書きできる
const DRIVE_SUBDIR = path.join('raku-bo', 'apk');

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
      '  2) 環境変数を設定してから再実行:\n' +
      '     RAKUBO_KEYSTORE_PATH=<jksの絶対パス>\n' +
      '     RAKUBO_KEYSTORE_PASSWORD=<ストアのパスワード>\n' +
      '     RAKUBO_KEY_ALIAS=rakubo\n' +
      '     RAKUBO_KEY_PASSWORD=<鍵のパスワード>\n\n' +
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

  const releaseSigningConfig = `        release {
            storeFile file(System.getenv("RAKUBO_KEYSTORE_PATH"))
            storePassword System.getenv("RAKUBO_KEYSTORE_PASSWORD")
            keyAlias System.getenv("RAKUBO_KEY_ALIAS")
            keyPassword System.getenv("RAKUBO_KEY_PASSWORD")
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
// ビルド
// ------------------------------------------------------------
// リリースは独自の署名鍵が揃っていないと先に進ませない（ビルド前に検査する）
if (!isDebug) {
  requireReleaseKeystore();
}

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
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
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
// Google ドライブへコピー（デスクトップ版がマウントしたドライブに置くだけ。
// 実体のアップロードは Google Drive 側が非同期でやる）
// ------------------------------------------------------------
function resolveDriveDir() {
  const candidates = [
    process.env.RAKUBO_DRIVE_DIR,
    'G:\\マイドライブ',
    'G:\\My Drive',
    path.join(os.homedir(), 'Google Drive'),
    path.join(os.homedir(), 'マイドライブ'),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

if (!skipUpload) {
  const driveRoot = resolveDriveDir();

  if (!driveRoot) {
    // ドライブが無くてもビルド自体は成功しているので、警告だけにする
    console.log('\n! Googleドライブが見つかりませんでした（コピーをスキップ）');
    console.log('  保存先を指定する場合は RAKUBO_DRIVE_DIR に設定してください');
  } else {
    const driveDir = path.join(driveRoot, DRIVE_SUBDIR);
    mkdirSync(driveDir, { recursive: true });

    // 同じ日に複数回ビルドしても上書きしないよう、時刻とコミットを付ける
    const time = new Date().toTimeString().slice(0, 5).replace(':', '');
    const revision = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
    }).stdout?.trim();
    const driveName = `rakubo-${isDebug ? 'debug' : 'release'}-${stamp}-${time}${revision ? `-${revision}` : ''}.apk`;
    const driveDestination = path.join(driveDir, driveName);

    console.log('\n--- Googleドライブへコピー ---');
    copyFileSync(destination, driveDestination);

    const apks = readdirSync(driveDir).filter((file) => file.endsWith('.apk'));
    const totalMb = apks.reduce((sum, file) => sum + statSync(path.join(driveDir, file)).size, 0) / 1024 / 1024;

    console.log(`✓ 保存: ${driveDestination}`);
    console.log(`  同期はGoogleドライブ側が自動で行う（フォルダ内 ${apks.length}件 / ${totalMb.toFixed(0)}MB）`);
  }
}
