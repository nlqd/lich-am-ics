import { computeDateFromLunarDate } from "./amlich.js";

const VIETNAM = 7;
export const MAX_YEARS = 50;

const DAY_MS = 86_400_000;
const toTime = ({ year, month, day }) => Date.UTC(year, month - 1, day);
const fromTime = (time) => {
  const d = new Date(time);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};
const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY_MS);
const addDays = (date, days) => fromTime(toTime(date) + days * DAY_MS);

// amlich returns [0, 0, 0] for a leap month the year doesn't have, and ignores the
// leap flag entirely in years without any leap month.
const monthStart = (month, leap, year) => {
  const start = computeDateFromLunarDate(1, month, year, leap ? 1 : 0, VIETNAM);
  return start.day ? start : null;
};

function hasLeapMonth(month, year) {
  const leap = monthStart(month, true, year);
  return leap !== null && toTime(leap) !== toTime(monthStart(month, false, year));
}

function monthLength(month, leap, year) {
  const next = !leap && hasLeapMonth(month, year)
    ? monthStart(month, true, year)
    : month === 12 ? monthStart(1, false, year + 1) : monthStart(month + 1, false, year);
  return daysBetween(monthStart(month, leap, year), next);
}

// The usual custom for anniversaries: a leap-month date is kept in the regular month in
// years without that leap month, and day 30 is kept on day 29 when the month has only 29 days.
export function occurrence({ day, month, leap }, lunarYear) {
  const inLeap = leap && hasLeapMonth(month, lunarYear);
  const keptDay = Math.min(day, monthLength(month, inLeap, lunarYear));
  return {
    solar: addDays(monthStart(month, inLeap, lunarYear), keptDay - 1),
    lunar: { day: keptDay, month, leap: inLeap, year: lunarYear, short: keptDay < day },
  };
}

// Lunar year Y ends in January or February of Y + 1, so start one year back.
export function upcoming(lunar, today, count) {
  const dates = [];
  for (let year = today.year - 1; dates.length < count; year++) {
    const o = occurrence(lunar, year);
    if (toTime(o.solar) >= toTime(today)) dates.push(o);
  }
  return dates;
}

export function validate({ day, month, years, title }) {
  const within = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  if (!title) return "Vui lòng nhập tiêu đề sự kiện.";
  if (!within(day, 1, 30)) return "Ngày âm lịch phải từ 1 đến 30.";
  if (!within(month, 1, 12)) return "Tháng âm lịch phải từ 1 đến 12.";
  if (!within(years, 1, MAX_YEARS)) return `Số năm lặp lại phải từ 1 đến ${MAX_YEARS}.`;
  return null;
}

export function lunarLabel({ day, month, leap, short }) {
  return `${day}/${month}${leap ? " nhuận" : ""} ÂL${short ? ", tháng thiếu" : ""}`;
}

const pad = (n) => String(n).padStart(2, "0");
const icsDate = ({ year, month, day }) => `${year}${pad(month)}${pad(day)}`;
const escapeText = (text) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// FNV-1a: a stable fingerprint of the event, so its UIDs survive re-downloads.
function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

// RFC 5545: lines are at most 75 octets; longer ones continue on lines starting with a space.
function fold(line) {
  const octets = (ch) => new TextEncoder().encode(ch).length;
  const parts = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    if (size + octets(ch) > 75) {
      parts.push(current);
      current = " ";
      size = 1;
    }
    current += ch;
    size += octets(ch);
  }
  parts.push(current);
  return parts.join("\r\n");
}

export function buildIcs(dates, { title, description = "", trigger = null, stamp }) {
  const series = fingerprint(title);
  const events = dates.flatMap((o) => [
    "BEGIN:VEVENT",
    `UID:${icsDate(o.solar)}-${series}@licham.dzungngo.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(o.solar)}`,
    `SUMMARY:${escapeText(`${title} (${lunarLabel(o.lunar)})`)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    "TRANSP:TRANSPARENT",
    "STATUS:CONFIRMED",
    ...(trigger ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", `TRIGGER:${trigger}`, "END:VALARM"] : []),
    "END:VEVENT",
  ]);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//licham.dzungngo.com//Lich Am//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
