@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ============================================================
rem release.bat
rem リリース用APKをビルドして配布できる状態にする
rem
rem やること:
rem   1. 事前チェック（ブランチ・未コミットの変更・型チェック）
rem   2. リリースAPKのビルド
rem      （署名鍵の読み込み・署名の検証・GitHub Release(draft)の作成は
rem        mobile/scripts/build-android.mjs が行う）
rem   3. draft作成後にやることの案内を表示
rem   4. 接続中のAndroid端末へインストール（任意）
rem
rem 署名鍵は ~/.rakubo/signing.env から読まれる。
rem 未設定ならビルドスクリプトが手順を表示して止まる。
rem
rem 配布先は GitHub Releases（タグは mobile/app.json の expo.version から
rem `v<version>` の形で作られる）。本人が説明文を公開前に確認できるよう、
rem リリースは --draft で作成される。GitHub 上で publish するまでは
rem スマホからダウンロードできない。version を上げ忘れて既存タグ／
rem 未publishのdraftと衝突するとビルドスクリプト側で止まるので、
rem リリースしたいときは先に mobile/app.json の expo.version を上げておくこと。
rem
rem draftのURLは build-android.mjs が gh release create の出力として
rem 表示する（gh release create は作成したリリースのURLを標準出力に出す）。
rem 引数なしの `gh release view` は「最新の公開リリース」を見る動作のため
rem draftを取れる保証が無く、ここでは使わない（未検証のまま当てにしない）。
rem ============================================================

set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

echo.
echo ============================================================
echo  らく〜ぼ リリースビルド
echo ============================================================
echo.

rem ---------- 1. 事前チェック ----------

pushd "%REPO%"

for /f "delims=" %%b in ('git branch --show-current 2^>nul') do set "BRANCH=%%b"
echo   ブランチ      : !BRANCH!

if not "!BRANCH!"=="main" (
  echo.
  echo   [注意] main 以外のブランチです。
  echo          配布物は通常 main から作ります。
  echo.
  choice /c YN /m "  このまま続けますか"
  if errorlevel 2 goto :aborted
)

git diff --quiet HEAD 2>nul
if errorlevel 1 (
  echo.
  echo   [注意] コミットされていない変更があります:
  git status --short
  echo.
  echo          この変更もビルドに含まれますが、コミットしていないと
  echo          「どのAPKが何を含むか」を後から追えなくなります。
  echo.
  choice /c YN /m "  このまま続けますか"
  if errorlevel 2 goto :aborted
)

echo   型チェック    : 実行中...
pushd "%REPO%\mobile"
call npx tsc --noEmit
if errorlevel 1 (
  popd
  popd
  echo.
  echo   [中止] 型エラーがあります。先に直してください。
  goto :failed
)
echo   型チェック    : OK
echo.

rem ---------- 2. ビルド ----------

echo ------------------------------------------------------------
echo  ビルド開始（10〜20分かかります）
echo ------------------------------------------------------------
echo.

call npm run build:android
if errorlevel 1 (
  popd
  popd
  echo.
  echo   [中止] ビルドに失敗しました。上のログを確認してください。
  goto :failed
)
popd
popd

rem ---------- 3. GitHub Release(draft) の案内 ----------

set "APK="
for /f "delims=" %%f in ('dir /b /o-d "%REPO%\mobile\build\rakubo-release-*.apk" 2^>nul') do (
  if not defined APK set "APK=%REPO%\mobile\build\%%f"
)

if not defined APK (
  echo.
  echo   [中止] ビルド成果物が見つかりません: %REPO%\mobile\build\
  goto :failed
)

echo.
echo ------------------------------------------------------------
echo  配布物の確認
echo ------------------------------------------------------------
echo   成果物        : !APK!
echo.
echo   GitHub Release は下書き（draft）として作成されます。
echo   作成されたリリースのURLは、上のビルドログ内（gh release create の
echo   出力）に表示されています。
echo.
echo   [重要] draft はまだ公開されていません。GitHub 上で説明文を確認し、
echo          問題なければ「Publish release」を押してください。
echo          publish するまでスマホからはダウンロードできません。
echo.
echo   確認・公開はこちら: https://github.com/YukkuriPannda/raku-bo/releases

rem ---------- 4. 端末へインストール（任意） ----------

:install
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo.
  echo   端末への導入は adb が見つからないためスキップします。
  goto :done
)

set "DEVICE="
for /f "skip=1 tokens=1,2" %%a in ('"%ADB%" devices 2^>nul') do (
  if "%%b"=="device" if not defined DEVICE set "DEVICE=%%a"
)

if not defined DEVICE (
  echo.
  echo   接続中の端末がないため、インストールはスキップします。
  echo   スマホから入れる場合は、GitHub Release(draft)を publish した後に
  echo   Assets からAPKを直接ダウンロードしてください。
  goto :done
)

echo.
echo   接続中の端末  : !DEVICE!
echo.
echo   [注意] 署名が違うAPK（デバッグ版など）が入っている場合、
echo          上書きに失敗します。その場合は一度アンインストールが必要で、
echo          アプリのデータとログイン状態が消えます。
echo.
choice /c YN /m "  この端末にインストールしますか"
if errorlevel 2 goto :done

echo.
"%ADB%" -s !DEVICE! install -r "!APK!"
if errorlevel 1 (
  echo.
  echo   [注意] インストールに失敗しました。
  echo          署名不一致なら、アンインストールしてから入れ直してください:
  echo            adb -s !DEVICE! uninstall com.rakubo.app
)

:done
echo.
echo ============================================================
echo  完了
echo ============================================================
echo.
echo   配布先: https://github.com/YukkuriPannda/raku-bo/releases
echo   [重要] GitHub Release はまだ draft（下書き）です。説明文を確認して
echo          publish するまで、スマホからはダウンロードできません。
echo.
pause
exit /b 0

:aborted
popd 2>nul
popd 2>nul
echo.
echo   中止しました。
echo.
pause
exit /b 1

:failed
echo.
pause
exit /b 1
