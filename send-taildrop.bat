@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ============================================================
rem send-taildrop.bat
rem Taildrop でファイルをスマホなどの自分の端末へ直接送る
rem
rem 使い方:
rem   send-taildrop.bat                  最新のリリースAPKを送る
rem   send-taildrop.bat <ファイル>       そのファイルを送る
rem   send-taildrop.bat <ファイル> <端末> 送り先を指定する
rem
rem 送り先は引数 > 環境変数 RAKUBO_TAILDROP_TARGET の順で決まる。
rem どちらも無いときは端末一覧を出して止まる（勝手に送らない）。
rem
rem GitHub Releases を経由せず手元のAPKをそのまま送れるので、
rem publish 前の動作確認に使う。配布（他人に渡す）経路ではない。
rem Android では受信後「ファイル」アプリのダウンロードに入る。
rem ============================================================

set "TS=%ProgramFiles%\Tailscale\tailscale.exe"
if not exist "%TS%" (
  echo   [中止] tailscale.exe が見つかりません: %TS%
  goto :failed
)

set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

rem ---------- 送るファイル ----------

set "FILE=%~1"
if not defined FILE (
  for /f "delims=" %%f in ('dir /b /o-d "%REPO%\mobile\build\rakubo-release-*.apk" 2^>nul') do (
    if not defined FILE set "FILE=%REPO%\mobile\build\%%f"
  )
  if not defined FILE (
    echo   [中止] APKが見つかりません: %REPO%\mobile\build\
    echo          先に release.bat でビルドするか、送るファイルを引数で渡してください。
    goto :failed
  )
)

if not exist "!FILE!" (
  echo   [中止] ファイルがありません: !FILE!
  goto :failed
)

rem ---------- 送り先 ----------

set "TARGET=%~2"
if not defined TARGET set "TARGET=%RAKUBO_TAILDROP_TARGET%"

if not defined TARGET (
  echo.
  echo   送り先が指定されていません。下の一覧から端末名を選んでください。
  echo.
  "%TS%" status
  echo.
  echo   例: send-taildrop.bat "!FILE!" my-phone
  echo   毎回指定したくない場合は環境変数 RAKUBO_TAILDROP_TARGET に端末名を入れておく。
  goto :failed
)

echo.
echo   送信元ファイル: !FILE!
echo   送り先        : !TARGET!
echo.

"%TS%" file cp "!FILE!" "!TARGET!:"
if errorlevel 1 (
  echo.
  echo   [中止] 送信に失敗しました。
  echo          端末名が一覧と一致しているか、受信側の Tailscale が
  echo          起動してログイン済みか確認してください。
  goto :failed
)

echo.
echo   送信しました。受信側の端末で通知を確認してください。
echo.
exit /b 0

:failed
echo.
exit /b 1
