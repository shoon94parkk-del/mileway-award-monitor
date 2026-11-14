@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mileway - 대한항공 공식 자동수집 설치
echo.
echo ================================================
echo  대한항공 공식 보너스좌석 PC 자동수집 설치
echo ================================================
echo.
echo 이 PC의 Chrome으로만 대한항공 공개 좌석을 조회합니다.
echo GitHub 인증은 공식 gh 로그인 창에서 직접 진행합니다.
echo 작업 스케줄러가 매일 오전 8시 30분에 실행됩니다.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $work=Join-Path $env:TEMP ('MilewayInstall-'+[guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Force -Path $work | Out-Null; $zip=Join-Path $work 'project.zip'; Invoke-WebRequest -Uri 'https://github.com/shoon94parkk-del/mileway-award-monitor/archive/refs/heads/main.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $work -Force; $dir=Get-ChildItem -Path $work -Directory | Where-Object Name -like 'mileway-award-monitor-*' | Select-Object -First 1; if(-not $dir){throw 'Cannot locate extracted installer'}; & (Join-Path $dir.FullName 'scripts/install-owned-windows-collector.ps1'); if($LASTEXITCODE){exit $LASTEXITCODE}"
set "result=%ERRORLEVEL%"
echo.
if "%result%"=="0" (
 echo 설치가 완료되었습니다. 대한항공 공식 좌석 조회는 Windows 작업 스케줄러에서 확인하세요.
) else (
 echo 설치에 실패했습니다. 위 오류를 ChatGPT에 보내주세요.
 echo Node.js 24+ / Chrome / Git / GitHub CLI 설치 여부를 확인하세요.
)
echo.
pause
exit /b %result%
