# This script runs exclusively on a Windows PC you control.
# It never exports browser cookies/passwords or calls the airline's private API.
param([switch]$CanaryOnly,[switch]$DryRun)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logFolder=Join-Path $env:LOCALAPPDATA 'MilewayCollector\logs'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$stamp=(Get-Date).ToString('yyyyMMdd-HHmmss')
$logFile=Join-Path $logFolder ("official-koreanair-"+$stamp+".log")
Set-Location $root
$env:MILEWAY_STANDARD_CHROME='1'
$env:MILEWAY_DIRECT_API='0'
if ($DryRun) { node --no-warnings scripts/run-owned-windows-collector.mjs --dry-run; exit $LASTEXITCODE }
Write-Host ('Mileway official Korean Air UI collection started. Log: '+$logFile)
try {
 $arguments=@('--no-warnings','scripts/run-owned-windows-collector.mjs')
 if($CanaryOnly){$arguments+='--canary-only'}
 node @arguments 2>&1 | Tee-Object -FilePath $logFile
 $exit=$LASTEXITCODE
 if($exit -ne 0){Write-Warning "Official collection did not complete. Previous published seats are preserved. Exit: $exit"}
 exit $exit
}catch{
 $_.ToString() | Out-File -FilePath $logFile -Append -Encoding UTF8
 Write-Error $_
 exit 1
}
