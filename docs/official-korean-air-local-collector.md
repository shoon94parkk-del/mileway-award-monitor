# 대한항공 공식 화면 수집기: 내 Windows PC 설치

**소스:** 대한항공 공식 [보너스 좌석 조회](https://www.koreanair.com/booking/book-and-manage/award-seat-availability) 한 곳만 사용합니다. 외부 업체 데이터, 프록시, 쿠키 복제, 비공식 API 직접 호출은 사용하지 않습니다.

## 왜 PC 실행인가

GitHub 공유 실행기에서는 대한항공 월간 보너스 좌석 조회가 HTTP 403(Akamai)으로 차단됩니다. 페이지·공항 목록은 열리지만 실제 좌석 데이터 조회는 거부됩니다. GitHub 실행기 수를 늘려 해결할 수 없습니다.

**개인 PC로 전환해도 성공을 보장하지는 않습니다.** PC에서도 403/429가 확인되면 수집을 중단하고 이전 검증 데이터를 보존합니다.

## 한 번 설치

Windows PC에 Chrome, Node.js 24+, Git, GitHub CLI(gh)가 필요합니다.

1. [원클릭 설치 파일](https://github.com/shoon94parkk-del/mileway-award-monitor/blob/main/scripts/install-owned-windows-collector.cmd)을 다운로드합니다.
2. Windows에서 실행하고, GitHub CLI가 본인 로그인 승인을 요청하면 브라우저에서 직접 승인합니다. 항공사 로그인 정보나 토큰을 스크립트에 입력하지 않습니다.
3. 설치가 완료되면 Windows 작업 스케줄러에 **Mileway-Official-KoreanAir-Collector**가 생성됩니다. 최초에도 실행하고 이후 PC 현지시간 매일 **08:30**에 실행됩니다. Windows 로그인된 세션이 필요합니다.
4. 로그는 `%LOCALAPPDATA%\MilewayCollector\logs`에 남습니다. 성공하면 본인 GitHub 인증으로 `public-data/`를 갱신하고 Render가 자동 배포합니다.

## 실행 흐름과 한계

- 대한항공 공식 브라우저 UI에서 인천 → 런던 1개 노선을 시험한 뒤, 성공한 경우만 인천 출발 33개와 유럽 귀국 14개 공항을 수집합니다.
- PC에서는 한 번에 브라우저 하나만 실행합니다. 5개 분할은 병렬 요청이 아닌 검증 단위입니다.
- 모든 대상 노선·월의 결과가 검증될 때만 해당 방향의 자료를 게시합니다. 오류가 나면 기존 게시물을 유지합니다.
- PC 전원이 꺼져 있거나 Windows 세션이 로그아웃되어 있으면 수집하지 못합니다.
- 대한항공의 공개 달력은 실시간 확정 재고가 아닙니다. 실제 예약 가능 여부는 대한항공에서 재확인해야 합니다.

## 수동 점검 및 중단

```powershell
# 하나의 공식 화면만 시험
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\MilewayCollector\repo\scripts\invoke-owned-windows-collector.ps1" -CanaryOnly

# 작업 스케줄러 확인
Get-ScheduledTask -TaskName "Mileway-Official-KoreanAir-Collector" | Get-ScheduledTaskInfo

# 자동 수집 중단
Unregister-ScheduledTask -TaskName "Mileway-Official-KoreanAir-Collector" -Confirm:$false
```
