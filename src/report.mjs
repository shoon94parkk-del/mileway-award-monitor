import fs from "node:fs";
import path from "node:path";
import { dataDir, ensureDataDirs } from "./config.mjs";

function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function writeAvailabilityReports(rows, metadata = {}) {
  ensureDataDirs();
  const uniqueRows = new Map();
  for (const row of rows) {
    uniqueRows.set([row.origin, row.destination, row.date, row.cabin].join("|"), row);
  }
  const available = [...uniqueRows.values()]
    .filter((row) => row.available)
    .sort((a, b) => `${a.date}|${a.destination}|${a.cabin}`.localeCompare(`${b.date}|${b.destination}|${b.cabin}`));
  const headers = ["region", "country", "city", "origin", "destination", "date", "cabin", "seats"];
  const csv = [
    headers.join(","),
    ...available.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\r\n") + "\r\n";

  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const csvPath = path.join(dataDir, `available-${stamp}.csv`);
  const latestCsvPath = path.join(dataDir, "available-latest.csv");
  const jsonPath = path.join(dataDir, `available-${stamp}.json`);
  const latestJsonPath = path.join(dataDir, "available-latest.json");
  const json = `${JSON.stringify({ ...metadata, generated_at: new Date().toISOString(), count: available.length, seats: available }, null, 2)}\n`;

  fs.writeFileSync(csvPath, `\ufeff${csv}`, "utf8");
  fs.writeFileSync(latestCsvPath, `\ufeff${csv}`, "utf8");
  fs.writeFileSync(jsonPath, json, "utf8");
  fs.writeFileSync(latestJsonPath, json, "utf8");
  return { csvPath, latestCsvPath, jsonPath, latestJsonPath, count: available.length };
}
