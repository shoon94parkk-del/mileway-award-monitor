import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const dataDir = path.join(projectRoot, "data");
export const rawDir = path.join(dataDir, "raw");
export const databasePath = path.join(dataDir, "seats.db");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function loadConfig() {
  const configPath = process.env.KAM_CONFIG_PATH
    ? path.resolve(process.env.KAM_CONFIG_PATH)
    : path.join(projectRoot, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  for (const key of ["departure", "start_date", "end_date"]) {
    if (!config[key]) throw new Error(`config.json에 ${key} 값이 필요합니다.`);
  }
  if (!config.routes_file && !config.arrival) {
    throw new Error("config.json에 routes_file 또는 arrival 값이 필요합니다.");
  }
  if (!ISO_DATE.test(config.start_date) || !ISO_DATE.test(config.end_date)) {
    throw new Error("start_date/end_date는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (config.start_date > config.end_date) throw new Error("start_date가 end_date보다 늦습니다.");

  config.departure = String(config.departure).toUpperCase();
  if (config.arrival) config.arrival = String(config.arrival).toUpperCase();
  config.cabins = (config.cabins ?? [config.cabin ?? "PRESTIGE"]).map((value) => String(value).toUpperCase());
  const allowedCabins = new Set(["ECONOMY", "PRESTIGE", "FIRST"]);
  if (!config.cabins.length || config.cabins.some((value) => !allowedCabins.has(value))) {
    throw new Error("cabins에는 ECONOMY, PRESTIGE, FIRST만 사용할 수 있습니다.");
  }
  config.regions = (config.regions ?? []).map(String);
  config.fare_classes = (config.fare_classes ?? []).map((value) => String(value).toUpperCase());
  config.scan_step_days = Math.min(30, Math.max(7, Number(config.scan_step_days || 30)));
  config.request_interval_ms = Math.max(3000, Number(config.request_interval_ms || 5000));
  config.poll_interval_minutes = Math.max(5, Number(config.poll_interval_minutes || 30));
  return config;
}

export function ensureDataDirs() {
  fs.mkdirSync(rawDir, { recursive: true });
}
