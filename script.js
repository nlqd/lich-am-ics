import { computeDateFromLunarDate } from "./amlich.js";

const lunarDayInput = document.getElementById("lunarDay");
const lunarMonthInput = document.getElementById("lunarMonth");
const eventTitleInput = document.getElementById("eventTitle");
const repeatYearsInput = document.getElementById("repeatYears");
const eventDescriptionInput = document.getElementById("eventDescription"); // Mới
const enableReminderCheckbox = document.getElementById("enableReminder"); // Mới
const reminderOptionsDiv = document.getElementById("reminderOptions"); // Mới
const reminderValueInput = document.getElementById("reminderValue"); // Mới
const reminderUnitSelect = document.getElementById("reminderUnit"); // Mới
const previewBtn = document.getElementById("previewBtn");
const generateBtn = document.getElementById("generateBtn");
const previewArea = document.getElementById("previewArea");

function formatDate(year, month, day) {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}${m}${d}`;
}

function escapeICSString(str) {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\") // Escape backslash first
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n"); // Escape newlines
}

function generateUID() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatDisplayDate(solarDate) {
  return `${String(solarDate.dd).padStart(2, "0")}/${String(solarDate.mm).padStart(2, "0")}/${solarDate.yy}`;
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function calculateSolarDates(lunarDay, lunarMonth, startYear, numYears) {
  const dates = [];
  let currentSolarYear = startYear;

  for (let i = 0; i < numYears; i++) {
    let attemptYear = currentSolarYear + i;

    try {
      let isLeap = false; // Hoặc 0
      // Gọi hàm đã import
      let solarResult = computeDateFromLunarDate(
        lunarDay,
        lunarMonth,
        attemptYear,
        isLeap,
        7,
      );

      if (
        solarResult &&
        solarResult.day &&
        solarResult.month !== undefined &&
        solarResult.year
      ) {
        // Kiểm tra month !== undefined vì có thể là 0
        let solarDate = {
          dd: solarResult.day,
          mm: solarResult.month,
          yy: solarResult.year,
        };
        dates.push({
          lunar: { day: lunarDay, month: lunarMonth, year: attemptYear },
          solar: solarDate,
        });
      } else {
        console.warn(
          `Không tìm thấy ngày dương lịch cho <span class="math-inline">\{lunarDay\}/</span>{lunarMonth} Âm lịch năm ${attemptYear}.`,
        );
      }
    } catch (error) {
      console.error(
        `Lỗi khi chuyển đổi ngày <span class="math-inline">\{lunarDay\}/</span>{lunarMonth} Âm lịch năm ${attemptYear}:`,
        error,
      );
      alert(
        "Đã xảy ra lỗi khi gọi thư viện chuyển đổi lịch. Vui lòng kiểm tra console.",
      );
      return [];
    }
  }
  return dates;
}

function displayPreview(calculatedDates, title) {
  if (!calculatedDates || calculatedDates.length === 0) {
    previewArea.textContent =
      "Không có ngày nào để hiển thị. Vui lòng kiểm tra lại thông tin nhập hoặc kết quả từ amlich.js.";
    return;
  }

  let previewText = `Xem trước cho sự kiện: "${title}"\n`;
  previewText += "------------------------------------------\n";
  previewText += "Ngày Âm Lịch  =>  Ngày Dương Lịch (Năm DL)\n";
  previewText += "------------------------------------------\n";

  calculatedDates.forEach((item) => {
    const lunarStr = `${String(item.lunar.day).padStart(2, "0")}/${String(item.lunar.month).padStart(2, "0")}`;
    const solarStr = formatDisplayDate(item.solar);
    previewText += `${lunarStr}        =>  ${solarStr} (${item.solar.yy})\n`;
  });

  previewArea.textContent = previewText;
}

function generateICSContent(calculatedDates, title, description, reminderSettings) {
    if (!calculatedDates || calculatedDates.length === 0) {
        alert("Không có ngày nào hợp lệ để tạo file ICS.");
        return null;
    }

    let icsString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourAppName//LunarCalendarGenerator//VI
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    const timestamp = getTimestamp();
    const escapedDescription = escapeICSString(description); // Escape mô tả

    calculatedDates.forEach(item => {
        const solarDateFormatted = formatDate(item.solar.yy, item.solar.mm, item.solar.dd);
        const uid = generateUID() + "@yourdomain.com"; // Thêm domain để tăng tính unique

        icsString += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${timestamp}
DTSTART;VALUE=DATE:${solarDateFormatted}
SUMMARY:${escapeICSString(title)} (${item.lunar.day}/${item.lunar.month} ÂL)
DESCRIPTION:${escapedDescription}
TRANSP:TRANSPARENT
SEQUENCE:0
STATUS:CONFIRMED
`;

        // Thêm VALARM nếu nhắc nhở được bật
        if (reminderSettings.enabled && reminderSettings.trigger) {
            icsString += `BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
TRIGGER;VALUE=DURATION:${reminderSettings.trigger}
END:VALARM
`;
        }

        icsString += `END:VEVENT
`;
    });

    icsString += 'END:VCALENDAR';
    return icsString;
}

function downloadICS(filename, content) {
  if (!content) return;

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

enableReminderCheckbox.addEventListener('change', () => {
    reminderOptionsDiv.style.display = enableReminderCheckbox.checked ? 'block' : 'none';
});

// Sự kiện click nút Xem trước (ít thay đổi, chủ yếu lấy thêm giá trị)
previewBtn.addEventListener('click', () => {
    const lunarDay = parseInt(lunarDayInput.value, 10);
    const lunarMonth = parseInt(lunarMonthInput.value, 10);
    const eventTitle = eventTitleInput.value.trim();
    // const eventDescription = eventDescriptionInput.value.trim(); // Preview không cần mô tả dài
    const repeatYears = parseInt(repeatYearsInput.value, 10);
    const currentYear = new Date().getFullYear();

    if (!lunarDay || !lunarMonth || !eventTitle || !repeatYears /* Thêm các kiểm tra khác nếu cần */) {
        alert('Vui lòng nhập đầy đủ và chính xác thông tin cơ bản!');
        previewArea.textContent = 'Vui lòng nhập đầy đủ và chính xác thông tin cơ bản.';
        return;
    }
    // Kiểm tra thư viện amlich.js nếu cần
    // if (typeof computeDateFromLunarDate !== 'function' && typeof convertLunarToSolar !== 'function') { ... }

    const calculatedDates = calculateSolarDates(lunarDay, lunarMonth, currentYear, repeatYears);
    displayPreview(calculatedDates, eventTitle); // Chỉ cần title cho preview
});

// Sự kiện click nút Tạo File ICS (Cập nhật quan trọng)
generateBtn.addEventListener('click', () => {
    // Lấy các giá trị cơ bản
    const lunarDay = parseInt(lunarDayInput.value, 10);
    const lunarMonth = parseInt(lunarMonthInput.value, 10);
    const eventTitle = eventTitleInput.value.trim();
    const repeatYears = parseInt(repeatYearsInput.value, 10);
    const currentYear = new Date().getFullYear();

    // Lấy giá trị mô tả và nhắc nhở
    const eventDescription = eventDescriptionInput.value.trim();
    const reminderEnabled = enableReminderCheckbox.checked;
    const reminderValue = parseInt(reminderValueInput.value, 10);
    const reminderUnit = reminderUnitSelect.value;

    // Kiểm tra tính hợp lệ của input
    if (!lunarDay || !lunarMonth || !eventTitle || !repeatYears /* Thêm các kiểm tra khác */) {
        alert('Vui lòng nhập đầy đủ và chính xác thông tin cơ bản!');
        return;
    }
    if (reminderEnabled && (!reminderValue || reminderValue < 1)) {
         alert('Vui lòng nhập giá trị hợp lệ cho thời gian nhắc nhở (lớn hơn 0).');
         return;
    }
    // Kiểm tra thư viện amlich.js nếu cần
    // if (typeof computeDateFromLunarDate !== 'function' && typeof convertLunarToSolar !== 'function') { ... }


    // Tính toán các ngày dương lịch
    const calculatedDates = calculateSolarDates(lunarDay, lunarMonth, currentYear, repeatYears);

    // Chuẩn bị cài đặt nhắc nhở
    let reminderSettings = {
        enabled: reminderEnabled,
        trigger: null
    };

    if (reminderEnabled) {
        let triggerPrefix = '-P'; // Mặc định cho ngày và tuần (Duration)
        let triggerSuffix = '';
        switch (reminderUnit) {
            case 'minutes':
                triggerPrefix = '-PT'; // Thêm T cho Time
                triggerSuffix = 'M';
                break;
            case 'hours':
                triggerPrefix = '-PT'; // Thêm T cho Time
                triggerSuffix = 'H';
                break;
            case 'weeks':
                triggerSuffix = 'W';
                break;
            case 'days':
            default:
                triggerSuffix = 'D';
                break;
        }
        // Định dạng TRIGGER: ví dụ -P1D (1 ngày trước), -PT15M (15 phút trước), -P2W (2 tuần trước)
        reminderSettings.trigger = `${triggerPrefix}${reminderValue}${triggerSuffix}`;
    }

    // Tạo nội dung ICS
    const icsContent = generateICSContent(calculatedDates, eventTitle, eventDescription, reminderSettings);

    // Tải file
    if (icsContent) {
        const filename = `lich_am_${lunarDay}_${lunarMonth}_${repeatYears}_nam.ics`;
        downloadICS(filename, icsContent);
    }
});

// Tùy chọn: Ẩn/hiện phần nhắc nhở khi tải trang lần đầu
window.addEventListener('load', () => {
    reminderOptionsDiv.style.display = enableReminderCheckbox.checked ? 'block' : 'none';
});

window.onload = () => {
  if (
    lunarDayInput.value &&
    lunarMonthInput.value &&
    eventTitleInput.value &&
    repeatYearsInput.value
  ) {
    previewBtn.click();
  }
};
