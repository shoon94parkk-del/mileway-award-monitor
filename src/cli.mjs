import { loadConfig } from "./config.mjs";
import { openDatabase, listCurrent } from "./database.mjs";
import { captureOnce, runMonitor } from "./monitor.mjs";
import { readCurrentCalendar } from "./uia.mjs";
import { loadRouteTargets } from "./routes.mjs";

const [command = "doctor", ...args] = process.argv.slice(2);

function printSnapshot(snapshot) {
  const prestige = snapshot.days.filter((day) => day.prestige).map((day) => day.date);
  const first = snapshot.days.filter((day) => day.first).map((day) => day.date);
  console.log(`Edge 연결 성공: ${snapshot.origin} → ${snapshot.destination}`);
  console.log(`탑승객: ${snapshot.passenger_summary || "확인 불가"}`);
  console.log(`읽은 날짜: ${snapshot.days.length}일 (${snapshot.range_months.join(", ")})`);
  console.log(`프레스티지 가능: ${prestige.length}일${prestige.length ? `\n${prestige.join(", ")}` : ""}`);
  console.log(`일등석 가능: ${first.length}일${first.length ? `\n${first.join(", ")}` : ""}`);
}

try {
  if (command === "doctor") {
    const config = loadConfig();
    printSnapshot(await readCurrentCalendar(config.uia?.window_title_pattern || "대한항공"));
  } else if (command === "capture") {
    const result = await captureOnce();
    printSnapshot(result.snapshot);
    console.log(`SQLite 저장 완료: ${result.rows.length}개 상태`);
  } else if (command === "monitor") {
    await runMonitor({ once: args.includes("--once"), waitForLogin: args.includes("--wait-for-login") });
  } else if (command === "routes") {
    const config = loadConfig();
    console.table(loadRouteTargets(config));
  } else if (command === "list") {
    const db = openDatabase();
    try {
      console.table(listCurrent(db, { availableOnly: args.includes("--available-only") }));
    } finally {
      db.close();
    }
  } else {
    throw new Error(`알 수 없는 명령: ${command}`);
  }
} catch (error) {
  console.error(`오류: ${error.message}`);
  process.exitCode = 1;
}
