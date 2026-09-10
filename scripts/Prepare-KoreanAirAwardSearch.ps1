param(
  [string]$WindowTitlePattern = "대한항공"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
$window = $null
foreach ($candidate in $windows) {
  if ($candidate.Current.Name -match $WindowTitlePattern) { $window = $candidate; break }
}
if (-not $window) {
  [ordered]@{ signed_in = $false; ready = $false; reason = "window-not-found" } | ConvertTo-Json -Compress
  exit 0
}

function Get-All {
  return $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
}

$all = Get-All
$calendarReady = $false
$signedIn = $false
$mileageButton = $null
$oneWayButton = $null
foreach ($element in $all) {
  $name = $element.Current.Name
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Pane -and
      $name -match "가는 날\s+출발지\s+[A-Z]{3}\s+도착지\s+[A-Z]{3}") { $calendarReady = $true }
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
      $name -match "^마이페이지") { $signedIn = $true }
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
      $name -eq "마일리지 예매") { $mileageButton = $element }
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::RadioButton -and
      $name -eq "편도") { $oneWayButton = $element }
}

if ($calendarReady) {
  [ordered]@{ signed_in = $true; ready = $true; reason = "calendar-open" } | ConvertTo-Json -Compress
  exit 0
}
if (-not $signedIn) {
  [ordered]@{ signed_in = $false; ready = $false; reason = "login-required" } | ConvertTo-Json -Compress
  exit 0
}
if (-not $mileageButton) { throw "마일리지 예매 버튼을 찾지 못했습니다." }

$toggle = $null
if (-not $mileageButton.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle)) {
  throw "마일리지 예매 모드를 선택할 수 없습니다."
}
if ($toggle.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::On) {
  $toggle.Toggle()
  Start-Sleep -Milliseconds 700
}

$all = Get-All
foreach ($element in $all) {
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::RadioButton -and
      $element.Current.Name -eq "편도") {
    $selection = $null
    if ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selection) -and
        -not $selection.Current.IsSelected) {
      $selection.Select()
      Start-Sleep -Milliseconds 250
    }
    break
  }
}

[ordered]@{ signed_in = $true; ready = $false; reason = "award-form-ready" } | ConvertTo-Json -Compress
