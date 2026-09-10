import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { projectRoot } from "./config.mjs";

const execFileAsync = promisify(execFile);

async function runPowerShell(scriptName, args = []) {
  const scriptPath = path.join(projectRoot, "scripts", scriptName);
  const shells = ["pwsh.exe", "powershell.exe"];
  let lastError;

  for (const shell of shells) {
    try {
      const { stdout } = await execFileAsync(shell, [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        ...args,
      ], {
        cwd: projectRoot,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      });
      return stdout.trim();
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT") break;
    }
  }

  const message = lastError?.stderr?.trim() || lastError?.message || "PowerShell 실행 실패";
  throw new Error(message);
}

export async function readCurrentCalendar(windowTitlePattern = "대한항공") {
  const output = await runPowerShell("Read-KoreanAirCalendar.ps1", [
    "-WindowTitlePattern",
    windowTitlePattern,
  ]);
  return JSON.parse(output);
}

export async function setAnchorDate(date, windowTitlePattern = "대한항공") {
  const output = await runPowerShell("Set-KoreanAirAnchorDate.ps1", [
    "-Date",
    date,
    "-WindowTitlePattern",
    windowTitlePattern,
  ]);
  return JSON.parse(output);
}

export async function setRoute(origin, destination, windowTitlePattern = "대한항공") {
  const output = await runPowerShell("Set-KoreanAirRoute.ps1", [
    "-Origin",
    origin,
    "-Destination",
    destination,
    "-WindowTitlePattern",
    windowTitlePattern,
  ]);
  return JSON.parse(output);
}

export async function prepareAwardSearch(windowTitlePattern = "대한항공") {
  const output = await runPowerShell("Prepare-KoreanAirAwardSearch.ps1", [
    "-WindowTitlePattern",
    windowTitlePattern,
  ]);
  return JSON.parse(output);
}

export function snapshotToRows(snapshot, cabin = "PRESTIGE") {
  const normalizedCabin = String(cabin).toUpperCase();
  const availabilityKey = {
    ECONOMY: "economy",
    PRESTIGE: "prestige",
    FIRST: "first",
  }[normalizedCabin];

  if (!availabilityKey) throw new Error(`지원하지 않는 cabin입니다: ${cabin}`);

  return snapshot.days.map((day) => ({
    date: day.date,
    origin: snapshot.origin,
    destination: snapshot.destination,
    flight: null,
    cabin: normalizedCabin,
    fareClass: null,
    available: Boolean(day[availabilityKey]),
    seats: day[availabilityKey] ? snapshot.requested_seats ?? null : null,
    sourcePath: `uia:${availabilityKey}`,
  }));
}
