import test from "node:test";
import assert from "node:assert/strict";
import { loadRouteTargets } from "../src/routes.mjs";

test("미주와 유럽 대상 노선 29개를 중복 없이 불러온다", () => {
  // Keep the test hermetic: CI does not have the user's local config.json.
  const routes = loadRouteTargets({
    routes_file: "routes.json",
    regions: ["north_america", "europe"],
  });
  assert.equal(routes.length, 29);
  assert.equal(new Set(routes.map((route) => route.code)).size, 29);
  assert.equal(routes.filter((route) => route.region === "north_america").length, 13);
  assert.equal(routes.filter((route) => route.region === "europe").length, 16);
});
