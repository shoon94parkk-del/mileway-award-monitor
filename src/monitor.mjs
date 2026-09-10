import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadConfig, rawDir, ensureDataDirs } from "./config.mjs";
import { openDatabase, recordRun } from "./database.mjs";
import { notifyTelegram, formatEvents } from "./notifier.mjs";
import { prepareAwardSearch, readCurrentCalendar, setAnchorDate, setRoute, snapshotToRows } from "./uia.mjs";
import { loadRouteTargets } from "./routes.mjs";
import { writeAvailabilityReports } from "./report.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function buildAnchors(startDate, endDate, stepDays) {
  const anchors = [];
  for (let date = startDate; date <= endDate; date = addDays(date, stepDays)) anchors.push(date);
  return [...new Set(anchors)];
}

function assertRoute(snapshot, origin, destination) {
  if (snapshot.origin !== origin || snapshot.destination !== destination) {
    throw new Error(
      `Edge 화면 노선은 ${snapshot.origin}→${snapshot.destination}인데 조회 대상은 ` +
      `${origin}→${destination}입니다. 잘못된 노선 저장을 중단했습니다.`,
    );
  }
}

function saveSnapshot(snapshot) {
  ensureDataDirs();
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const file = path.join(rawDir, `${stamp}-${snapshot.origin}-${snapshot.destination}.json`);
  fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return file;
}

const hashSnapshot = (snapshot) => createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

export async function captureOnce({
  targetRoute = null,
  filterConfiguredRange = false,
  requestedSeats = null,
  passengerSummary = null,
} = {}) {
  const config = loadConfig();
  const snapshot = await readCurrentCalendar(config.uia?.window_title_pattern || "대한항공");
  if (snapshot.requested_seats == null && requestedSeats != null) snapshot.requested_seats = requestedSeats;
  if (!snapshot.passenger_summary && passengerSummary) snapshot.passenger_summary = passengerSummary;
  if (targetRoute) assertRoute(snapshot, config.departure, targetRoute.code);

  const rows = config.cabins
    .flatMap((cabin) => snapshotToRows(snapshot, cabin))
    .filter((row) => !filterConfiguredRange || (row.date >= config.start_date && row.date <= config.end_date));
  const rawFile = saveSnapshot(snapshot);
  const db = openDatabase();
  try {
    const result = recordRun(db, {
      endpoint: "windows-uia",
      statusCode: 200,
      payloadHash: hashSnapshot(snapshot),
      rawFile,
      rows,
      notifyOnFirstSeen: config.notifications?.notify_on_first_seen !== false,
    });
    await notifyTelegram(config, result.events);
    return { snapshot, rows, events: result.events, rawFile };
  } finally {
    db.close();
  }
}

export async function scanDateRangeForRoute(route) {
  const config = loadConfig();
  const anchors = buildAnchors(config.start_date, config.end_date, config.scan_step_days);
  const combined = { route, snapshots: [], rows: [], events: [] };

  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    console.log(`  ${anchor} 기준 주변일자 조회 (${index + 1}/${anchors.length})`);
    const selection = await setAnchorDate(anchor, config.uia?.window_title_pattern || "대한항공");
    const result = await captureOnce({
      targetRoute: route,
      filterConfiguredRange: true,
      requestedSeats: selection.requested_seats,
      passengerSummary: selection.passenger_summary,
    });
    combined.snapshots.push(result.snapshot);
    combined.rows.push(...result.rows.map((row) => ({
      ...row,
      region: route.region,
      country: route.country,
      city: route.city,
    })));
    combined.events.push(...result.events);
    if (index + 1 < anchors.length) await sleep(config.request_interval_ms);
  }
  return combined;
}

export async function scanAllConfiguredRoutes() {
  const config = loadConfig();
  const windowTitlePattern = config.uia?.window_title_pattern || "대한항공";
  const routes = loadRouteTargets(config);
  if (!routes.length) throw new Error("조회할 노선이 routes.json에 없습니다.");

  // 인증을 대신 처리하지 않는다. 사용자가 띄운 마일리지 주변일자조회 결과인지 먼저 확인한다.
  let initial;
  try {
    initial = await readCurrentCalendar(windowTitlePattern);
  } catch {
    throw new Error(
      "Edge에서 대한항공 로그인 후 마일리지 예매의 주변일자조회 결과를 한 번 열어 주세요. " +
      "인증은 보안상 자동 처리하지 않습니다.",
    );
  }
  if (initial.origin !== config.departure) {
    throw new Error(`Edge 출발지는 ${initial.origin}인데 설정은 ${config.departure}입니다.`);
  }

  const combined = { routes, snapshots: [], rows: [], events: [], errors: [] };
  let report = null;
  for (let index = 0; index < routes.length; index++) {
    const route = routes[index];
    console.log(`[${index + 1}/${routes.length}] ${config.departure}→${route.code} ${route.city}`);
    try {
      await setRoute(config.departure, route.code, windowTitlePattern);
      const result = await scanDateRangeForRoute(route);
      combined.snapshots.push(...result.snapshots);
      combined.rows.push(...result.rows);
      combined.events.push(...result.events);
    } catch (error) {
      const item = { route: route.code, message: error.message };
      combined.errors.push(item);
      console.error(`  노선 실패: ${error.message}`);
    }
    report = writeAvailabilityReports(combined.rows, {
      origin: config.departure,
      start_date: config.start_date,
      end_date: config.end_date,
      cabins: config.cabins,
      routes_total: routes.length,
      routes_completed: index + 1,
      last_route: route.code,
      errors: combined.errors,
    });
    if (index + 1 < routes.length) await sleep(config.request_interval_ms);
  }

  return { ...combined, report };
}

async function waitForLoginAndPrepare(config) {
  const windowTitlePattern = config.uia?.window_title_pattern || "대한항공";
  const firstRoute = loadRouteTargets(config)[0];
  let lastMessageAt = 0;

  while (true) {
    try {
      await readCurrentCalendar(windowTitlePattern);
      return;
    } catch {
      const state = await prepareAwardSearch(windowTitlePattern);
      if (state.signed_in) {
        console.log("로그인 확인. 마일리지 편도 검색 화면을 자동 준비합니다.");
        await setRoute(config.departure, firstRoute.code, windowTitlePattern);
        await setAnchorDate(config.start_date, windowTitlePattern);
        await readCurrentCalendar(windowTitlePattern);
        return;
      }
    }

    if (Date.now() - lastMessageAt > 5 * 60_000 || lastMessageAt === 0) {
      console.log("Edge 대한항공 로그인을 기다리는 중입니다. 로그인만 완료하면 자동으로 시작합니다.");
      lastMessageAt = Date.now();
    }
    await sleep(30_000);
  }
}

export async function runMonitor({ once = false, waitForLogin = false } = {}) {
  const config = loadConfig();
  while (true) {
    console.log(
      `[${new Date().toLocaleString("ko-KR")}] ${config.departure} 출발 ` +
      `${config.cabins.join("+")} ${config.start_date}~${config.end_date} 조회 시작`,
    );
    if (waitForLogin) await waitForLoginAndPrepare(config);
    const result = await scanAllConfiguredRoutes();
    const available = result.rows.filter((row) => row.available);
    console.log(`전체 조회 완료: 가능 좌석 ${available.length}건, 실패 노선 ${result.errors.length}개`);
    console.log(`CSV: ${result.report.latestCsvPath}`);
    console.log(`JSON: ${result.report.latestJsonPath}`);
    const newText = formatEvents(result.events);
    if (newText) console.log(`\n${newText}\n`);
    if (once) return result;
    console.log(`${config.poll_interval_minutes}분 뒤 다시 확인합니다. 종료: Ctrl+C`);
    await sleep(config.poll_interval_minutes * 60_000);
  }
}
