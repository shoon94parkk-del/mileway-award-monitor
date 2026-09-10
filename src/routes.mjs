import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./config.mjs";

export function loadRouteTargets(config) {
  if (!config.routes_file) {
    return [{ region: "custom", code: config.arrival, city: config.arrival, country: "" }];
  }

  const routesPath = path.resolve(projectRoot, config.routes_file);
  const data = JSON.parse(fs.readFileSync(routesPath, "utf8"));
  const enabledRegions = new Set(config.regions ?? []);
  const seen = new Set();

  return (data.routes ?? [])
    .filter((route) => route.enabled !== false)
    .filter((route) => enabledRegions.size === 0 || enabledRegions.has(route.region))
    .map((route) => ({
      ...route,
      code: String(route.code).toUpperCase(),
    }))
    .filter((route) => {
      if (!/^[A-Z]{3}$/.test(route.code) || seen.has(route.code)) return false;
      seen.add(route.code);
      return true;
    });
}
