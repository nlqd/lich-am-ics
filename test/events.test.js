// Expected dates were cross-checked against xemlicham.com, licham.vn and an ephemeris-based calendar.
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildIcs, occurrence, upcoming, validate } from "../events.js";

const ymd = ({ year, month, day }) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

test("an ordinary date converts as usual", () => {
  assert.equal(ymd(occurrence({ day: 10, month: 3, leap: false }, 2027).solar), "2027-04-16");
});

test("day 30 of a 29-day month is kept on the 29th instead of rolling into Tết", () => {
  const o = occurrence({ day: 30, month: 12, leap: false }, 2026);
  assert.deepEqual([ymd(o.solar), o.lunar.day], ["2027-02-05", 29]);
});

test("day 30 of a 30-day month stays on the 30th", () => {
  const o = occurrence({ day: 30, month: 12, leap: false }, 2033);
  assert.deepEqual([ymd(o.solar), o.lunar.day], ["2034-02-18", 30]);
});

test("day 30 before a leap month does not spill into the leap month", () => {
  assert.equal(ymd(occurrence({ day: 30, month: 3, leap: false }, 2031).solar), "2031-04-20");
});

test("a leap-month date lands in the leap month when the year has it", () => {
  const o = occurrence({ day: 10, month: 3, leap: true }, 2031);
  assert.deepEqual([ymd(o.solar), o.lunar.leap], ["2031-04-30", true]);
});

test("a leap-month date falls back to the regular month in other years", () => {
  const o = occurrence({ day: 10, month: 3, leap: true }, 2027);
  assert.deepEqual([ymd(o.solar), o.lunar.leap], ["2027-04-16", false]);
});

test("the 2033 leap month 11 is found", () => {
  assert.equal(ymd(occurrence({ day: 15, month: 11, leap: true }, 2033).solar), "2034-01-05");
});

test("in January before Tết, the late-month date of the old lunar year still comes first", () => {
  const first = upcoming({ day: 23, month: 12, leap: false }, { year: 2027, month: 1, day: 10 }, 3)[0];
  assert.equal(ymd(first.solar), "2027-01-30");
});

test("dates already past are left out and the count is still filled", () => {
  const dates = upcoming({ day: 15, month: 1, leap: false }, { year: 2026, month: 10, day: 8 }, 2);
  assert.deepEqual(dates.map((o) => o.solar.year), [2027, 2028]);
  assert.equal(ymd(dates[1].solar), "2028-02-09");
});

test("today itself counts as upcoming", () => {
  const first = upcoming({ day: 10, month: 3, leap: false }, { year: 2027, month: 4, day: 16 }, 1)[0];
  assert.equal(ymd(first.solar), "2027-04-16");
});

const sample = () =>
  upcoming({ day: 30, month: 12, leap: false }, { year: 2026, month: 10, day: 8 }, 3);
const ics = (stamp = "20261008T000000Z") =>
  buildIcs(sample(), {
    title: "Giỗ ông nội, bà nội; và cả họ hàng bên nội ở quê nhà Thái Bình",
    description: "Chuẩn bị đồ cúng\nmời mọi người",
    trigger: "-P1D",
    stamp,
  });

test("ics lines end with CRLF only", () => {
  assert.equal(ics().replace(/\r\n/g, "").includes("\n"), false);
});

test("ics lines are folded to at most 75 octets", () => {
  const longest = Math.max(...ics().split("\r\n").map((line) => new TextEncoder().encode(line).length));
  assert.ok(longest <= 75, `longest line is ${longest} octets`);
});

test("folding keeps the text intact, accents included", () => {
  const summary = ics().replace(/\r\n /g, "").split("\r\n").find((line) => line.startsWith("SUMMARY:"));
  assert.equal(summary, "SUMMARY:Giỗ ông nội\\, bà nội\\; và cả họ hàng bên nội ở quê nhà Thái Bình (29/12 ÂL\\, tháng thiếu)");
});

test("event UIDs are the same on every download, so re-importing updates instead of duplicating", () => {
  const uids = (text) => text.split("\r\n").filter((line) => line.startsWith("UID:"));
  assert.deepEqual(uids(ics("20261008T000000Z")), uids(ics("20271231T235959Z")));
});

test("each event in a file has its own UID", () => {
  const uids = ics().split("\r\n").filter((line) => line.startsWith("UID:"));
  assert.equal(new Set(uids).size, 3);
});

test("a leap-month event says so in its title", () => {
  const text = buildIcs([occurrence({ day: 10, month: 3, leap: true }, 2031)], { title: "Giỗ", stamp: "20261008T000000Z" });
  assert.match(text, /SUMMARY:Giỗ \(10\/3 nhuận ÂL\)/);
});

test("valid input passes", () => {
  assert.equal(validate({ day: 30, month: 12, years: 50, title: "Giỗ" }), null);
});

test("out-of-range input is refused instead of silently shifted", () => {
  for (const input of [
    { day: 31, month: 1, years: 5, title: "x" },
    { day: 0, month: 1, years: 5, title: "x" },
    { day: 1, month: 13, years: 5, title: "x" },
    { day: 1, month: 1, years: 51, title: "x" },
    { day: 1, month: 1, years: 5, title: "" },
    { day: Number.NaN, month: 1, years: 5, title: "x" },
  ]) {
    assert.notEqual(validate(input), null, JSON.stringify(input));
  }
});
