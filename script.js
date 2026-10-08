import { buildIcs, lunarLabel, upcoming, validate } from "./events.js";

const field = (id) => document.getElementById(id);
const previewArea = field("previewArea");
const reminderOptions = field("reminderOptions");

function readForm() {
  return {
    day: parseInt(field("lunarDay").value, 10),
    month: parseInt(field("lunarMonth").value, 10),
    leap: field("lunarLeap").checked,
    title: field("eventTitle").value.trim(),
    description: field("eventDescription").value.trim(),
    years: parseInt(field("repeatYears").value, 10),
    reminder: field("enableReminder").checked
      ? { value: parseInt(field("reminderValue").value, 10), unit: field("reminderUnit").value }
      : null,
  };
}

function today() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

// -P1D for days, -PT15M for minutes: hours and minutes need the T.
function reminderTrigger({ value, unit }) {
  const units = { minutes: ["-PT", "M"], hours: ["-PT", "H"], days: ["-P", "D"], weeks: ["-P", "W"] };
  const [prefix, suffix] = units[unit] ?? units.days;
  return `${prefix}${value}${suffix}`;
}

function datesFor(input) {
  const problem = validate(input);
  if (problem) {
    alert(problem);
    previewArea.textContent = problem;
    return null;
  }
  return upcoming(input, today(), input.years);
}

const pad = (n) => String(n).padStart(2, "0");
const showDate = ({ year, month, day }) => `${pad(day)}/${pad(month)}/${year}`;

function showPreview() {
  const input = readForm();
  const dates = datesFor(input);
  if (!dates) return;
  const lines = dates.map((o) => `${showDate(o.solar)}  ${lunarLabel(o.lunar)}`);
  previewArea.textContent = [`Xem trước cho sự kiện: "${input.title}"`, "Ngày dương lịch  (ngày âm lịch)", "", ...lines].join("\n");
}

function download(filename, content) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function generate() {
  const input = readForm();
  if (input.reminder && !(input.reminder.value >= 1)) {
    alert("Vui lòng nhập giá trị hợp lệ cho thời gian nhắc nhở (lớn hơn 0).");
    return;
  }
  const dates = datesFor(input);
  if (!dates) return;
  const ics = buildIcs(dates, {
    title: input.title,
    description: input.description,
    trigger: input.reminder && reminderTrigger(input.reminder),
    stamp: new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
  });
  download(`lich_am_${input.day}_${input.month}${input.leap ? "_nhuan" : ""}_${input.years}_nam.ics`, ics);
}

const syncReminder = () => {
  reminderOptions.style.display = field("enableReminder").checked ? "block" : "none";
};

field("enableReminder").addEventListener("change", syncReminder);
field("previewBtn").addEventListener("click", showPreview);
field("generateBtn").addEventListener("click", generate);
window.addEventListener("load", () => {
  syncReminder();
  if (field("lunarDay").value && field("lunarMonth").value && field("eventTitle").value) showPreview();
});
