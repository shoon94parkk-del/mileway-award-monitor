param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^\d{4}-\d{2}-\d{2}$")]
  [string]$Date,
  [string]$WindowTitlePattern = "대한항공",
  [int]$LoadTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-KoreanAirWindow {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  $fallback = $null
  foreach ($window in $windows) {
    $name = $window.Current.Name
    if ($name -notmatch $WindowTitlePattern) { continue }
    if ($name -match "주변일자조회") { return $window }
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
    throw "버튼을 실행할 수 없습니다: $($Element.Current.Name)"
  }
  $pattern.Invoke()
}

function Find-Button {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$ExactName,
    [string]$NamePattern
  )
  $all = Get-All -Element $Window
  foreach ($element in $all) {
    if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) { continue }
    $name = $element.Current.Name
    if ($ExactName -and $name -eq $ExactName) { return $element }
    if ($NamePattern -and $name -match $NamePattern) { return $element }
  }
  return $null
}

$target = [DateTime]::ParseExact($Date, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$window = Get-KoreanAirWindow

$selectButton = Find-Button -Window $window -ExactName "선택"
if (-not $selectButton) {
  $departureButton = Find-Button -Window $window -NamePattern "^출발일\s+"
  if (-not $departureButton) {
    $all = Get-All -Element $window
    $summaryToggle = $null
    foreach ($element in $all) {
      if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
          [string]::IsNullOrWhiteSpace($element.Current.Name)) {
        $rect = $element.Current.BoundingRectangle
        if (-not [double]::IsInfinity($rect.X) -and $rect.X -ge 850 -and $rect.Y -ge 150 -and $rect.Y -le 240) {
          $summaryToggle = $element
          break
        }
      }
    }
    if (-not $summaryToggle) { throw "여정 수정 패널 버튼을 찾지 못했습니다." }
    Invoke-Element -Element $summaryToggle
    Start-Sleep -Milliseconds 500
    $departureButton = Find-Button -Window $window -NamePattern "^출발일\s+"
  }
  if (-not $departureButton) { throw "출발일 버튼을 찾지 못했습니다." }
  Invoke-Element -Element $departureButton
  Start-Sleep -Milliseconds 700
}

$window = Get-KoreanAirWindow
$all = Get-All -Element $window
$passengerSummary = $null
$requestedSeats = $null
foreach ($element in $all) {
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
      $element.Current.Name -match "^탑승객\s+(?<summary>.+)$") {
    $passengerSummary = $Matches.summary.Trim()
    if ($passengerSummary -match "(?<count>\d+)\s*석") { $requestedSeats = [int]$Matches.count }
    break
  }
}
$headerPattern = "^{0}년\s+{1}월\s*$" -f $target.Year, $target.Month
$headerIndex = -1
for ($i = 0; $i -lt $all.Count; $i++) {
  $element = $all.Item($i)
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Text -and
      $element.Current.Name -match $headerPattern) {
    $headerIndex = $i
    break
  }
}
if ($headerIndex -lt 0) { throw "날짜 선택기에서 $($target.ToString('yyyy년 M월'))을 찾지 못했습니다." }

$dayButton = $null
$dayPattern = "^{0}일," -f $target.Day
for ($i = $headerIndex + 1; $i -lt $all.Count; $i++) {
  $element = $all.Item($i)
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Text -and
      $element.Current.Name -match "^20\d{2}년\s+\d{1,2}월\s*$") {
    break
  }
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
      $element.Current.Name -match $dayPattern) {
    $dayButton = $element
    break
  }
}
if (-not $dayButton) { throw "$Date 날짜는 현재 선택할 수 없습니다." }

Invoke-Element -Element $dayButton
Start-Sleep -Milliseconds 250

$all = Get-All -Element $window
foreach ($element in $all) {
  if ($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::CheckBox -and
      $element.Current.Name -eq "가까운 날짜 함께 조회") {
    $toggle = $null
    if ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle) -and
        $toggle.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::On) {
      $toggle.Toggle()
    }
    break
  }
}

$selectButton = Find-Button -Window $window -ExactName "선택"
if (-not $selectButton) { throw "날짜 선택 확인 버튼을 찾지 못했습니다." }
Invoke-Element -Element $selectButton
Start-Sleep -Milliseconds 500

$searchButton = Find-Button -Window $window -ExactName "항공편 검색"
if (-not $searchButton) { throw "항공편 검색 버튼을 찾지 못했습니다." }
Invoke-Element -Element $searchButton

$deadline = (Get-Date).AddSeconds($LoadTimeoutSeconds)
do {
  Start-Sleep -Milliseconds 700
  $window = Get-KoreanAirWindow
  $all = Get-All -Element $window
  $foundSelectedDate = $false
  $calendarButtonCount = 0
  foreach ($element in $all) {
    if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) { continue }
    $name = $element.Current.Name
    if ($name -match "^\d{2}월\s+\d{2}일") { $calendarButtonCount++ }
    if ($name -match ("^{0:MM}월\s+{0:dd}일.*선택됨" -f $target)) { $foundSelectedDate = $true }
  }
  if ($foundSelectedDate -and $calendarButtonCount -ge 20) {
    [ordered]@{
      selected_date = $Date
      loaded = $true
      calendar_days = $calendarButtonCount
      passenger_summary = $passengerSummary
      requested_seats = $requestedSeats
    } |
      ConvertTo-Json -Compress
    exit 0
  }
} while ((Get-Date) -lt $deadline)

throw "$Date 주변일자 결과가 제한 시간 안에 로드되지 않았습니다."
