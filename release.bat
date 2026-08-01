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
rem      （署名鍵の読み込み・署名の検証・Googleドライブへの配置は
rem        mobile/scripts/build-android.mjs が行う）
rem   3. ドライブの rakubo-latest.apk を今回の成果物に差し替え
rem   4. 接続中のAndroid端末へインストール（任意）
rem
rem 署名鍵は ~/.rakubo/signing.env から読まれる。
rem 未設定ならビルドスクリプトが手順を表示して止まる。
rem ============================================================

set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

if "%RAKUBO_DRIVE_DIR%"=="" (
  set "DRIVE_DIR=G:\マイドライブ\raku-bo\apk"
) else (
  set "DRIVE_DIR=%RAKUBO_DRIVE_DIR%"
)

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

rem ---------- 3. rakubo-latest.apk の差し替え ----------

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
echo  配布物の更新
echo ------------------------------------------------------------
echo   成果物        : !APK!

if not exist "%DRIVE_DIR%" (
  echo.
  echo   [注意] ドライブのフォルダが見つかりません: %DRIVE_DIR%
  echo          Googleドライブが同期していない可能性があります。
  echo          rakubo-latest.apk の差し替えはスキップします。
  goto :install
)

copy /y "!APK!" "%DRIVE_DIR%\rakubo-latest.apk" >nul
if errorlevel 1 (
  echo   [注意] rakubo-latest.apk の更新に失敗しました。
) else (
  echo   latest 更新   : %DRIVE_DIR%\rakubo-latest.apk
)

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
  echo   スマホから入れる場合はドライブの rakubo-latest.apk を使ってください。
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
echo   配布先: %DRIVE_DIR%
echo   スマホからは rakubo-latest.apk をダウンロードしてください。
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
