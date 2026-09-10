param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Za-z]{3}$")]
  [string]$Destination,
  [ValidatePattern("^[A-Za-z]{3}$")]
  [string]$Origin = "SEL",
  [string]$WindowTitlePattern = "대한항공",
  [int]$TimeoutSeconds = 15
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$Origin = $Origin.ToUpperInvariant()
$Destination = $Destination.ToUpperInvariant()

function Get-KoreanAirWindow {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  $fallback = $null
  foreach ($window in $windows) {
    $name = $window.Current.Name
    if ($name -notmatch $WindowTitlePattern) { continue }
    if ($name -match "주변일자조회|항공권 예약") { return $window }
    if (-not $fallback) { $fallback = $window }
  }
  if ($fallback) { return $fallback }
  throw "대한항공 Edge 창을 찾지 못했습니다."
}

function Get-All {
  param([System.Windows.Automation.AutomationElement]$Element)
  return $Element.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
}

function Invoke-Element {
  param([System.Windows.Automation.AutomationElement]$Element)
  $pattern = $null
  if (-not $Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    throw "요소를 실행할 수 없습니다: $($Element.Current.Name)"
  }
  $pattern.Invoke()
}

function Expand-TripSummaryIfNeeded {
  param([System.Windows.Automation.AutomationElement]$Window)
  $all = Get-All -Element $Window
  foreach ($element in $all) {
    if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
        $element.Current.Name -match "^도착지\s+") { return }
  }

  foreach ($element in $all) {
    if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button -or
        -not [string]::IsNullOrWhiteSpace($element.Current.Name)) { continue }
    $rect = $element.Current.BoundingRectangle
    if (-not [double]::IsInfinity($rect.X) -and $rect.X -ge 850 -and $rect.Y -ge 150 -and $rect.Y -le 240) {
      Invoke-Element -Element $element
      Start-Sleep -Milliseconds 500
      return
    }
  }
}

function Set-Airport {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$Kind,
    [string]$Code
  )

  Expand-TripSummaryIfNeeded -Window $Window
  $all = Get-All -Element $Window
  $button = $null
  foreach ($element in $all) {
    if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
        $element.Current.Name -match ("^{0}\s+" -f $Kind)) {
      $button = $element
      break
    }
  }
  if (-not $button) { throw "$Kind 버튼을 찾지 못했습니다." }
  if ($button.Current.Name -match ("\b{0}\b" -f $Code)) { return }

  Invoke-Element -Element $button
  Start-Sleep -Milliseconds 400

  $searchName = "$Kind 검색"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $combo = $null
  do {
    $all = Get-All -Element $Window
    foreach ($element in $all) {
      if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::ComboBox -and
          $element.Current.Name -eq $searchName) {
        $combo = $element
        break
      }
    }
    if ($combo) { break }
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)
  if (-not $combo) { throw "$searchName 입력창을 찾지 못했습니다." }

  $valuePattern = $null
  if (-not $combo.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
    throw "$searchName 값을 입력할 수 없습니다."
  }
  $valuePattern.SetValue($Code)

  $result = $null
  do {
    Start-Sleep -Milliseconds 250
    $all = Get-All -Element $Window
    foreach ($element in $all) {
      if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::ListItem -and
          $element.Current.Name -match ("(?:^|\s){0}(?:\s|$)" -f $Code) -and
          $element.Current.Name -notmatch "여정\s+\d") {
        $result = $element
        break
      }
    }
    if ($result) { break }
  } while ((Get-Date) -lt $deadline)
  if (-not $result) { throw "$Code 공항 검색 결과를 찾지 못했습니다." }

  Invoke-Element -Element $result
  Start-Sleep -Milliseconds 400
}

$window = Get-KoreanAirWindow
Set-Airport -Window $window -Kind "출발지" -Code $Origin
$window = Get-KoreanAirWindow
Set-Airport -Window $window -Kind "도착지" -Code $Destination

$window = Get-KoreanAirWindow
$all = Get-All -Element $window
$originFound = $false
$destinationFound = $false
foreach ($element in $all) {
  if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) { continue }
  if ($element.Current.Name -match ("^출발지\s+.*\b{0}\b" -f $Origin)) { $originFound = $true }
  if ($element.Current.Name -match ("^도착지\s+.*\b{0}\b" -f $Destination)) { $destinationFound = $true }
}
if (-not $originFound -or -not $destinationFound) {
  throw "노선 변경 검증에 실패했습니다: $Origin → $Destination"
}

[ordered]@{ origin = $Origin; destination = $Destination; changed = $true } | ConvertTo-Json -Compress
