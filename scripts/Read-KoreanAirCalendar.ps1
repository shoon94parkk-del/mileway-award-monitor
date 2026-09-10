param(
  [string]$WindowTitlePattern = "대한항공"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-KoreanAirWindow {
  param([string]$Pattern)

  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $windows = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  $fallback = $null
  foreach ($window in $windows) {
    $name = $window.Current.Name
    if ($name -notmatch $Pattern) { continue }
    if ($name -match "주변일자조회") { return $window }
    if (-not $fallback) { $fallback = $window }
  }

  if ($fallback) { return $fallback }
  throw "대한항공 Edge 창을 찾지 못했습니다. 보너스 주변일자조회 화면을 Edge에 열어 주세요."
}

function Get-AllDescendants {
  param([System.Windows.Automation.AutomationElement]$Element)
  return $Element.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
}

$window = Get-KoreanAirWindow -Pattern $WindowTitlePattern
$all = Get-AllDescendants -Element $window

$calendarPane = $null
$passengerSummary = $null
for ($i = 0; $i -lt $all.Count; $i++) {
  $element = $all.Item($i)
  $name = $element.Current.Name
  if (-not $calendarPane -and
      $element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Pane -and
      $name -match "가는 날\s+출발지\s+[A-Z]{3}\s+도착지\s+[A-Z]{3}") {
    $calendarPane = $element
  }
  if (-not $passengerSummary -and
      $element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
      $name -match "^탑승객\s+") {
    $passengerSummary = ($name -replace "^탑승객\s+", "").Trim()
  }
}

if (-not $calendarPane) {
  throw "날짜별 보너스 좌석 표를 찾지 못했습니다. 주변일자조회 결과가 화면에 표시되어 있는지 확인해 주세요."
}

$origin = $null
$destination = $null
if ($calendarPane.Current.Name -match "출발지\s+(?<origin>[A-Z]{3})\s+도착지\s+(?<destination>[A-Z]{3})") {
  $origin = $Matches.origin
  $destination = $Matches.destination
}

$passengerSeats = $null
if ($passengerSummary -and $passengerSummary -match "(?<count>\d+)\s*석") {
  $passengerSeats = [int]$Matches.count
}

$calendarElements = Get-AllDescendants -Element $calendarPane
$monthToYear = @{}
$rangeLabels = [System.Collections.Generic.List[string]]::new()

for ($i = 0; $i -lt $calendarElements.Count; $i++) {
  $name = $calendarElements.Item($i).Current.Name
  if ($name -match "(?<year>20\d{2})년\s*(?<month>\d{1,2})월\s*$") {
    $month = [int]$Matches.month
    $year = [int]$Matches.year
    $monthToYear[$month] = $year
    $rangeLabels.Add(("{0:D4}-{1:D2}" -f $year, $month))
  }
}

$days = [System.Collections.Generic.List[object]]::new()
for ($i = 0; $i -lt $calendarElements.Count; $i++) {
  $element = $calendarElements.Item($i)
  if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) { continue }
  $name = $element.Current.Name
  if ($name -notmatch "^(?<month>\d{2})월\s+(?<day>\d{2})일") { continue }

  $month = [int]$Matches.month
  $day = [int]$Matches.day
  if (-not $monthToYear.ContainsKey($month)) { continue }
  $year = [int]$monthToYear[$month]

  $hasEconomy = $name.Contains("일반석")
  $hasPrestige = $name.Contains("프레스티지석")
  $hasFirst = $name.Contains("일등석")
  $noSeat = $name.Contains("좌석 없음")
  $date = ("{0:D4}-{1:D2}-{2:D2}" -f $year, $month, $day)

  $days.Add([ordered]@{
    date = $date
    economy = $hasEconomy
    prestige = $hasPrestige
    first = $hasFirst
    no_seat = $noSeat
    peak_season = $name.Contains("성수기")
    selected = $name.Contains("선택됨")
    enabled = $element.Current.IsEnabled
    raw_label = $name
  })
}

if ($days.Count -eq 0) {
  throw "날짜별 좌석 버튼을 읽지 못했습니다. 결과 로딩이 끝난 뒤 다시 실행해 주세요."
}

$result = [ordered]@{
  observed_at = [DateTime]::UtcNow.ToString("o")
  window_title = $window.Current.Name
  source = "windows-uia"
  origin = $origin
  destination = $destination
  passenger_summary = $passengerSummary
  requested_seats = $passengerSeats
  range_months = @($rangeLabels | Select-Object -Unique)
  days = @($days)
}

$result | ConvertTo-Json -Depth 6 -Compress
