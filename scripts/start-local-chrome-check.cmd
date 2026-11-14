@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mileway - 대한항공 표준 Chrome 1회 검사
echo.
echo ================================================
echo   Mileway: 내 PC Chrome 1회 좌석 조회 검사
echo ================================================
echo GitHub 공유 실행기와 내 PC의 결과를 비교합니다.
echo 아이디, 비밀번호, API 키는 입력하지 않습니다.
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [필요] Node.js 24 이상이 없습니다.
  echo https://nodejs.org/ 에서 Node.js LTS를 설치한 후 재실행하세요.
  goto :failed
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [필요] npm이 없습니다. Node.js LTS를 설치하세요.
  goto :failed
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $folder=Join-Path $env:TEMP ('Mileway-Local-Check-'+[guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Force -Path $folder | Out-Null; $zip=Join-Path $folder 'main.zip'; Write-Host 'GitHub 공개 프로젝트의 최신 버전을 가져오는 중...'; Invoke-WebRequest -Uri 'https://github.com/shoon94parkk-del/mileway-award-monitor/archive/refs/heads/main.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $folder -Force; $project=Get-ChildItem -Path $folder -Directory | Where-Object Name -like 'mileway-award-monitor-*' | Select-Object -First 1; if(-not $project){throw '프로젝트 폴더를 찾을 수 없습니다.'}; Write-Host ('로컬 검사 폴더: '+$project.FullName); & (Join-Path $project.FullName 'scripts/run-local-standard-chrome-check.ps1'); exit $LASTEXITCODE"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo [성공] 내 PC에서는 대한항공 좌석 조회가 동작합니다.
  echo [판단] GitHub 실행 환경이나 접속 경로의 차이를 조사해야 합니다.
) else (
  echo [실패/차단] 내 PC에서도 조회 성공은 확인되지 않았습니다. 코드: %RESULT%
  echo [판단] 화면 오류와 403 차단은 로컬 검사 로그를 통해 구분하세요.
)
echo 이 창의 마지막 결과와 화면 로그를 ChatGPT에 보내주세요.
pause
exit /b %RESULT%
:failed
echo.
echo 검사를 실행하지 않았습니다.
pause
exit /b 1
