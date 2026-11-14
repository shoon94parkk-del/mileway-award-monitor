# A single, normal-browser diagnostic from a Windows PC.
# No proxy, bot-detection evasion, credential extraction or direct inventory API.
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js 24+ 설치가 필요합니다: https://nodejs.org/'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Error 'npm 설치가 필요합니다.'
}
$env:MILEWAY_STANDARD_CHROME='1'
$env:MILEWAY_DIRECT_API='0'
Write-Host '대한항공 공개 보너스 달력을 설치된 Chrome에서 1회만 확인합니다.'
Write-Host '이 테스트는 GitHub 공용 IP 차단과 실제 이용 회선의 차이를 구분하기 위한 것입니다.'
npm.cmd install --no-save --package-lock=false playwright@1.62.1
if ($LASTEXITCODE -ne 0) { throw 'Playwright 설치 실패' }
node --no-warnings scripts/collection-canary.mjs
$result=$LASTEXITCODE
if ($result -eq 0) {
  Write-Host '정상: 이 PC의 표준 Chrome에서 공개 달력 조회가 확인됐습니다.'
  Write-Host '결과 파일: data/public-canary/results.json'
} elseif ($result -eq 75) {
  Write-Warning '접근 제한 403/429. 추가 조회를 하지 않고 중단합니다.'
} else {
  Write-Warning '정상 조회를 확인하지 못했습니다. 추가 반복 조회 대신 진단 결과를 확인하세요.'
}
exit $result
