import test from "node:test";
import assert from "node:assert/strict";
import { snapshotToRows } from "../src/uia.mjs";

const snapshot = {
  origin: "ICN",
  destination: "CDG",
  requested_seats: 2,
  days: [
    { date: "2027-04-01", economy: true, prestige: false, first: false },
    { date: "2027-04-02", economy: true, prestige: true, first: false },
  ],
};

test("프레스티지 접근성 상태를 DB 행으로 변환한다", () => {
  const rows = snapshotToRows(snapshot, "PRESTIGE");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].available, false);
  assert.equal(rows[0].seats, null);
  assert.equal(rows[1].available, true);
  assert.equal(rows[1].seats, 2);
  assert.equal(rows[1].origin, "ICN");
  assert.equal(rows[1].destination, "CDG");
});

test("지원하지 않는 객실은 거부한다", () => {
  assert.throws(() => snapshotToRows(snapshot, "BUSINESS"), /지원하지 않는 cabin/);
});
