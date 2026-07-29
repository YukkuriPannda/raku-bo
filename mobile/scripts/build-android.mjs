#!/usr/bin/env node
// ============================================================
// scripts/build-android.mjs
// EAS を使わずローカルで Android APK をビルドする
//
//   npm run build:android          リリースAPK（配布用・本番バックエンド）
//   npm run build:android -- --debug   デバッグAPK（Metro必須・開発用）
//   npm run build:android -- --clean   android/ を作り直してからビルド
//
// EAS の `--local` は Windows 非対応のため、prebuild + Gradle を直接叩く。
// PATH 上の java が古くても動くよう、JDK と Android SDK は自前で探す。
// ============================================================

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const projectRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const isDebug = args.includes('--debug');
const isClean = args.includes('--clean');

// 配布ビルドの接続先。開発機（.env の Tailscale/LAN アドレス）を
// 焼き込まないよう、リリース時は明示的に本番URLを渡す。
// constants/api.ts 側にも実行時ガードがあるが、そもそもバンドルに
// 開発機のURLを入れないためにここで上書きする。
const PRODUCTION_API_URL = 'https://raku-bo-backend.funa-hayate.workers.dev';

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

console.log(`\n✓ 完成: ${destination}`);
console.log('  端末にインストール: adb install -r "' + destination + '"');
