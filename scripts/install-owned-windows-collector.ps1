# Install one daily, user-owned Windows task for ONLY the official Korean Air UI.
# Requires the account owner's one-time GitHub OAuth approval; no tokens in files.
param([switch]$NoStart)
$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT'){throw 'Windows PC에서만 설치할 수 있습니다.'}
$programs=@(
 @{Name='Node.js 24 이상';Command='node';Url='https://nodejs.org/'},
 @{Name='Git';Command='git';Url='https://git-scm.com/downloads/win'},
 @{Name='GitHub CLI';Command='gh';Url='https://cli.github.com/'}
)
foreach($program in $programs){
 if(-not (Get-Command $program.Command -ErrorAction SilentlyContinue)){
  throw ($program.Name+' 설치가 필요합니다: '+$program.Url)
 }
}
$major=[int]((node --version).Trim().TrimStart('v').Split('.')[0])
if($major -lt 24){throw 'Node.js 24 이상이 필요합니다.'}
$chromeCandidates=@(
 (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
 (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Google\Chrome\Application\chrome.exe'),
 (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
if(-not ($chromeCandidates | Where-Object {Test-Path $_} | Select-Object -First 1)){
 throw '설치된 Chrome이 없습니다: https://www.google.com/chrome/'
}

$homeDir=Join-Path $env:LOCALAPPDATA 'MilewayCollector'
$repo=Join-Path $homeDir 'repo'
New-Item -ItemType Directory -Force -Path $homeDir | Out-Null
Write-Host '1/5. GitHub 인증 확인 (브라우저에서 본인이 직접 승인)'
& gh auth status *> $null
if($LASTEXITCODE -ne 0){
 & gh auth login --web --git-protocol https
 if($LASTEXITCODE -ne 0){throw 'GitHub 인증을 완료하지 못했습니다.'}
}
& gh auth setup-git
if($LASTEXITCODE -ne 0){throw 'GitHub CLI Git 인증 연결 실패'}
Write-Host '2/5. GitHub 공식 프로젝트 설치'
if(Test-Path (Join-Path $repo '.git')){
 $remote=(& git -C $repo remote get-url origin).Trim()
 if($remote -notmatch '^https://github\.com/shoon94parkk-del/mileway-award-monitor(?:\.git)?$'){
  throw ('이미 존재하는 저장소 주소가 다릅니다: '+$remote)
 }
 $dirty=(& git -C $repo status --porcelain --untracked-files=no)
 if($LASTEXITCODE -ne 0 -or $dirty){throw '로컬 프로젝트가 수정되어 있어 안전한 자동 업데이트를 중단합니다.'}
 & git -C $repo pull --ff-only origin main
 if($LASTEXITCODE -ne 0){throw 'GitHub 프로젝트 최신화 실패'}
}else{
 if(Test-Path $repo){throw '대상 폴더가 이미 있습니다. 수동 확인 필요: '+$repo}
 & git clone --branch main --single-branch https://github.com/shoon94parkk-del/mileway-award-monitor.git $repo
 if($LASTEXITCODE -ne 0){throw 'GitHub 프로젝트 복제 실패'}
}
Set-Location $repo
$login=(& gh api user --jq '.login').Trim()
$userId=(& gh api user --jq '.id').Trim()
if(-not $login -or $userId -notmatch '^\d+$'){throw '인증된 GitHub 계정을 확인할 수 없습니다'}
& git config user.name $login
& git config user.email ($userId+'+'+$login+'@users.noreply.github.com')
Write-Host '3/5. 표준 Chrome 자동화 설치'
& npm.cmd install --no-save --package-lock=false playwright@1.62.1
if($LASTEXITCODE -ne 0){throw 'Playwright 설치 실패'}
Write-Host '4/5. 출국 33개·귀국 14개 검증 계획 확인 (아직 항공사 조회 없음)'
& node --no-warnings scripts/run-owned-windows-collector.mjs --dry-run
if($LASTEXITCODE -ne 0){throw '수집 계획 검증 실패'}

Write-Host '5/5. 내 Windows에서 매일 08:30 수집 작업 등록'
$taskName='Mileway-Official-KoreanAir-Collector'
$entry=Join-Path $repo 'scripts\invoke-owned-windows-collector.ps1'
$ps="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$taskAction=New-ScheduledTaskAction -Execute $ps -Argument ('-NoProfile -ExecutionPolicy Bypass -File "'+$entry+'"') -WorkingDirectory $repo
$taskTrigger=New-ScheduledTaskTrigger -Daily -At '08:30'
$taskSettings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4)
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Principal $principal -Force | Out-Null
Write-Host ('등록 완료: '+$taskName+' / 내 PC에서 매일 오전 08:30 (로그인된 세션 필요)')
Write-Host ('로그: '+(Join-Path $homeDir 'logs'))
if(-not $NoStart){
 Write-Host '사용자 PC에서 공식 대한항공 1회 시험을 포함한 첫 수집 실행'
 Start-ScheduledTask -TaskName $taskName
 Write-Host '첫 수집을 시작했습니다. 상태는 작업 스케줄러와 로그 폴더에서 확인할 수 있습니다.'
}
