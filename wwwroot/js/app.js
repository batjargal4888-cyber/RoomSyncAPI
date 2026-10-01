// Virtual canvas size (portrait floor plan)
const BASE_WIDTH = 830;
const BASE_HEIGHT = 1160;

// Space around each room, so rooms look separated by walls
const ROOM_GAP = 6;

// Common areas from the floor plan (drawn only, not stored in the DB)
const AREAS = [
    { label: "廊下", x: 375, y: 290, width: 210, height: 870 },
    { label: "入出口", x: 0, y: 945, width: 375, height: 215 },
    { label: "ロビー", x: 585, y: 850, width: 245, height: 310, corner: true }
];

// Round tables (600) in the lounge: center point
const ROUND_TABLES = [
    { x: 660, y: 980 },
    { x: 720, y: 1090 }
];
const TABLE_SIZE = 70;

// L-shaped corner sofa in the lobby (2 pieces)
const SOFAS = [
    { x: 591, y: 856, width: 175, height: 58 }, // along A's wall
    { x: 766, y: 856, width: 58, height: 298 } // along the outer wall
];

// Entrance door = a gap in the bottom wall
const DOOR = { x: 20, width: 140 };

// Currently selected room (null = nothing selected)
let selectedRoomId = null;

// Date currently shown (defaults to today)
let currentDate = new Date();

// First day of the month shown in the calendar
let calendarMonth = null;

// Bookable hours, in 30-minute slots
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const SLOT_MINUTES = 30;

// Lunch break: no booking allowed in this range
const LUNCH_START = 12 * 60;
const LUNCH_END = 13 * 60;

// Room divs by id (to update their colors)
const roomElements = {};

// Convert a canvas value to a percentage of the floor
function toPercent(value, base) {
    return (value / base * 100) + "%";
}

// Format a Date as "YYYY-MM-DD" in local time
function formatDateParam(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// Extract "HH:mm" from "2026-09-28T10:00:00"
function formatTime(iso) {
    return iso.slice(11, 16);
}

// Minutes from midnight -> "HH:mm"
function toHHMM(minutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    return `${h}:${m}`;
}

// "HH:mm" -> minutes from midnight
function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

// <option> tags every 30 minutes between two times
function buildTimeOptions(fromMinutes, toMinutes, selectedMinutes) {
    let html = "";
    for (let t = fromMinutes; t <= toMinutes; t += SLOT_MINUTES) {
        const selected = t === selectedMinutes ? "selected" : "";
        html += `<option value="${toHHMM(t)}" ${selected}>${toHHMM(t)}</option>`;
    }
    return html;
}

// Start-time options, skipping the lunch break
function buildStartOptions(from, selected) {
    let html = "";
    for (let t = from; t < CLOSE_HOUR * 60; t += SLOT_MINUTES) {
        if (t >= LUNCH_START && t < LUNCH_END) continue;
        const sel = t === selected ? "selected" : "";
        html += `<option value="${toHHMM(t)}" ${sel}>${toHHMM(t)}</option>`;
    }
    return html;
}

// Morning bookings must end by lunch; afternoon ones by closing time
function latestEnd(start) {
    return start < LUNCH_START ? LUNCH_START : CLOSE_HOUR * 60;
}

// Minutes -> "2時間" / "1時間30分" / "30分"
function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}分`;
    return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

// Escape user text before putting it into innerHTML (prevents XSS)
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// Show today's date and time, e.g. "9月29日 (火) 09:23"
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("clock").textContent =
        `${now.getMonth() + 1}月${now.getDate()}日 (${WEEKDAYS[now.getDay()]}) ${h}:${m}`;
}

async function loadRooms() {
    const res = await fetch("/api/rooms");
    if (!res.ok) {
        console.error("会議室の取得に失敗しました：", res.status);
        return;
    }

    const rooms = await res.json();
    const floor = document.getElementById("floor");

    document.getElementById("statTotal").textContent = rooms.length;

    rooms.forEach(room => {
        const div = document.createElement("div");
        div.className = "room";

        // Position & size relative to the floor (shrunk a little on every side)
        div.style.left   = toPercent(room.positionX + ROOM_GAP, BASE_WIDTH);
        div.style.top    = toPercent(room.positionY + ROOM_GAP, BASE_HEIGHT);
        div.style.width  = toPercent(room.width - ROOM_GAP * 2, BASE_WIDTH);
        div.style.height = toPercent(room.height - ROOM_GAP * 2, BASE_HEIGHT);

        div.innerHTML = `
            <div class="name">${room.name}</div>
            <div class="cap">${room.capacity}名</div>
        `;

        // Select room on click
        div.onclick = () => selectRoom(room, div);

        roomElements[room.id] = div;
        floor.appendChild(div);
    });
}

// Place an element on the floor using canvas units
function placeOnFloor(div, x, y, width, height) {
    div.style.left = toPercent(x, BASE_WIDTH);
    div.style.top = toPercent(y, BASE_HEIGHT);
    div.style.width = toPercent(width, BASE_WIDTH);
    div.style.height = toPercent(height, BASE_HEIGHT);
}

// Draw common areas, lounge tables & the entrance door
function renderAreas() {
    const floor = document.getElementById("floor");

    AREAS.forEach(area => {
        const div = document.createElement("div");
        div.className = "area";
        if (area.height > area.width * 2) div.classList.add("vertical");
        if (area.corner) div.classList.add("corner");
        placeOnFloor(div, area.x, area.y, area.width, area.height);
        div.textContent  = area.label;
        floor.appendChild(div);
    });

    SOFAS.forEach(s => {
        const div = document.createElement("div");
        div.className = "sofa";
        placeOnFloor(div, s.x, s.y, s.width, s.height);
        floor.appendChild(div);
    });

    ROUND_TABLES.forEach(t => {
        const div = document.createElement("div");
        div.className = "round-table";
        placeOnFloor(div, t.x - TABLE_SIZE / 2, t.y - TABLE_SIZE / 2, TABLE_SIZE, TABLE_SIZE);
        floor.appendChild(div);
    });

    const door = document.createElement("div");
    door.className = "door";
    door.style.left  = toPercent(DOOR.x, BASE_WIDTH);
    door.style.width = toPercent(DOOR.width, BASE_WIDTH);
    floor.appendChild(door);
}

// Highlight the clicked room & show its details
function selectRoom(room, div) {
    document.querySelectorAll(".room.selected")
        .forEach(el => el.classList.remove("selected"));

    div.classList.add("selected");
    selectedRoomId = room.id;
    renderRoomDetail(room);
    loadBookings(room.id);
}

// Render room info & booking form into the side panel
function renderRoomDetail(room) {
    const detail = document.getElementById("roomDetail");
    detail.innerHTML = `
        <div class="detail-head">
            <h3 class="detail-name">会議室 ${room.name}</h3>
            <span class="detail-cap">定員 ${room.capacity}名</span>
        </div>
        <h4 id="bookingTitle" class="detail-subtitle"></h4>
        <div id="timeline" class="timeline">
            <p class="booking-empty">読み込み中...</p>
        </div>

        <form id="bookingForm" class="booking-form" hidden>
            <h4 class="detail-subtitle">新規予約</h4>
            <div class="time-row">
                <label>開始
                    <select id="startTime"></select>
                </label>
                <label>終了
                    <select id="endTime"></select>
                </label>
            </div>
            <label>会議名
                <input type="text" id="purpose" maxlength="50" placeholder="例：定例ミーティング">
            </label>
            <p id="formError" class="form-error"></p>
            <div class="form-actions">
                <button type="button" id="cancelBtn" class="btn-secondary">キャンセル</button>
                <button type="submit" class="btn-primary">予約する</button>
            </div>
        </form>
    `;

    document.getElementById("cancelBtn").onclick = closeBookingForm;
    document.getElementById("startTime").onchange = updateEndOptions;
    document.getElementById("bookingForm").onsubmit = e => submitBooking(e, room.id);

    // Click a free slot -> open the form at that time
    document.getElementById("timeline").onclick = e => {
        const slot = e.target.closest(".tl-free");
        if (slot) openBookingForm(Number(slot.dataset.start));
    };
}

// Fetch bookings for the room on the current date
async function loadBookings(roomId) {
    const date = formatDateParam(currentDate);
    const res = await fetch(`/api/bookings?roomId=${roomId}&date=${date}`);

    // Ignore the response if another room was selected meanwhile
    if (roomId !== selectedRoomId) return;

    document.getElementById("bookingTitle").textContent = isToday(currentDate)
        ? "本日の予約"
        : `${currentDate.getMonth() + 1}月${currentDate.getDate()}日 (${WEEKDAYS[currentDate.getDay()]}) の予約`;

    if (!res.ok) {
        document.getElementById("timeline").innerHTML =
            `<p class="booking-empty">予約を取得できませんでした</p>`;
        return;
    }

    const bookings = await res.json();
    renderTimeline(bookings);
}

// Draw bookings, the lunch break, and the free gaps between them
function renderTimeline(bookings) {
    const timeline = document.getElementById("timeline");

    if (isWeekend(currentDate)) {
        timeline.innerHTML = `<p class="booking-empty">土日は予約できません</p>`;
        return;
    }

    const earliest = earliestStart();
    const now = new Date();

    // Treat lunch as a fixed block so free slots are split around it
    const items = bookings.map(b => ({
        start: toMinutes(formatTime(b.startTime)),
        end: toMinutes(formatTime(b.endTime)),
        booking: b
    }));
    items.push({ start: LUNCH_START, end: LUNCH_END, booking: null });
    items.sort((a, b) => a.start - b.start);

    let cursor = OPEN_HOUR * 60;
    let html = "";

    items.forEach(item => {
        html += freeSlotHtml(cursor, item.start, earliest);
        html += item.booking
            ? bookingHtml(item.booking, item.start, item.end, now)
            : lunchHtml();
        cursor = Math.max(cursor, item.end);
    });
    html += freeSlotHtml(cursor, CLOSE_HOUR * 60, earliest);

    timeline.innerHTML = html;
}

// Lunch break block (not clickable)
function lunchHtml() {
    return `
        <div class="tl-item tl-lunch">
            <span class="tl-time">${toHHMM(LUNCH_START)}</span>
            <span class="tl-dot"></span>
            <div class="tl-card">
                <span class="tl-title">昼休み</span>
                <span class="tl-meta">${toHHMM(LUNCH_START)}-${toHHMM(LUNCH_END)}・予約不可</span>
            </div>
        </div>
    `;
}

// One booking card
function bookingHtml(b, start, end, now) {
    const inUse = isToday(currentDate)
        && new Date(b.startTime) <= now && now < new Date(b.endTime);

    return `
        <div class="tl-item tl-booking ${inUse ? "tl-now" : ""}">
            <span class="tl-time">${toHHMM(start)}</span>
            <span class="tl-dot"></span>
            <div class="tl-card">
                <span class="tl-title">${escapeHtml(b.purpose) || "(会議名なし)"}</span>
                <span class="tl-meta">${toHHMM(start)}-${toHHMM(end)}・${formatDuration(end - start)}・${escapeHtml(b.userName)}</span>
                ${inUse ? `<span class="tl-badge">利用中</span>` : ""}
            </div>
        </div>
    `;
}

// A clickable free slot (only the part that can still be booked)
function freeSlotHtml(from, to, earliest) {
    if (earliest === null) return "";
    const start = Math.max(from, earliest);
    if (to - start < SLOT_MINUTES) return "";

    return `
        <div class="tl-item tl-free" data-start="${start}">
            <span class="tl-time">${toHHMM(start)}</span>
            <span class="tl-dot"></span>
            <div class="tl-card">
                <span class="tl-title">空き</span>
                <span class="tl-meta">${toHHMM(start)}-${toHHMM(to)}・クリックで予約</span>
            </div>
        </div>
    `;
}

// True if the given date is today
function isToday(date) {
    return formatDateParam(date) === formatDateParam(new Date());
}

// Saturday or Sunday
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

// True if both dates are the same calendar day
function isSameDay(a, b) {
    return formatDateParam(a) === formatDateParam(b);
}

// Switch the viewed date and refresh everything that depends on it
function setDate(date) {
    currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    calendarMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    renderCalendar();
    loadStatus();
    if (selectedRoomId !== null) loadBookings(selectedRoomId);
}

// Draw the month grid for calendarMonth
function renderCalendar() {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();

    // Empty cells before the 1st so it lands on the right weekday
    let cells = "<span></span>".repeat(firstWeekday);

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const classes = ["cal-day"];
        if (isSameDay(date, today)) classes.push("today");
        if (isSameDay(date, currentDate)) classes.push("selected");
        const disabled = isWeekend(date) ? "disabled" : "";
        cells += `<button type="button" class="${classes.join(" ")}" data-day="${d}" ${disabled}>${d}</button>`;
    }

    document.getElementById("calendar").innerHTML = `
        <div class="cal-head">
            <button type="button" class="cal-nav" data-move="-1" aria-label="前の月">‹</button>
            <span>${y}年${m + 1}月</span>
            <button type="button" class="cal-nav" data-move="1" aria-label="次の月">›</button>
        </div>
        <div class="cal-grid">
            ${WEEKDAYS.map(w => `<span class="cal-week">${w}</span>`).join("")}
            ${cells}
        </div>
        <button type="button" class="cal-today" data-today ${isWeekend(today) ? "disabled" : ""}>今日</button>
    `;
}

// Earliest bookable minute on the viewed date (null = date is in the past)
function earliestStart() {
    const today = formatDateParam(new Date());
    const viewed = formatDateParam(currentDate);
    if (viewed < today) return null;
    if (viewed > today) return OPEN_HOUR * 60;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const next = Math.ceil(nowMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.max(next, OPEN_HOUR * 60);
}

// Color rooms by whether they are in use right now
async function loadStatus() {
    // "In use" only makes sense for today
    if (!isToday(currentDate)) {
        Object.values(roomElements).forEach(div => div.classList.remove("busy"));
        document.getElementById("statFree").textContent = "-";
        document.getElementById("statBusy").textContent = "-";
        return;
    }

    const date = formatDateParam(currentDate);
    const res = await fetch(`/api/bookings?date=${date}`);
    if (!res.ok) {
        console.error("予約の取得に失敗しました", res.status);
        return;
    }

    const bookings = await res.json();
    const now = new Date();

    // Room ids with a booking that covers the current time
    const busyIds = new Set();
    bookings.forEach(b => {
        if (new Date(b.startTime) <= now && now < new Date(b.endTime)) {
            busyIds.add(b.roomId);
        }
    });

    Object.entries(roomElements).forEach(([id, div]) => {
        div.classList.toggle("busy", busyIds.has(Number(id)));
    });

    const total = Object.keys(roomElements).length;
    document.getElementById("statFree").textContent = total - busyIds.size;
    document.getElementById("statBusy").textContent = busyIds.size;
}

// Keep end-time options after the start time (default: +1 hour)
function updateEndOptions() {
    const start = toMinutes(document.getElementById("startTime").value);
    const last = latestEnd(start);
    const defaultEnd = Math.min(start + 60, last);
    document.getElementById("endTime").innerHTML =
        buildTimeOptions(start + SLOT_MINUTES, last, defaultEnd);
}

// Show the booking form, starting at the clicked free slot
function openBookingForm(start) {
    document.getElementById("startTime").innerHTML = buildStartOptions(earliestStart(), start);
    updateEndOptions();
    document.getElementById("purpose").value = "";
    document.getElementById("formError").textContent = "";
    document.getElementById("bookingForm").hidden = false;
    document.getElementById("purpose").focus();
}

// Hide the booking form
function closeBookingForm() {
    document.getElementById("bookingForm").hidden = true;
}

// Send a new booking for the selected room
async function submitBooking(e, roomId) {
    e.preventDefault(); // stop the page from reloading

    const errorEl = document.getElementById("formError");
    errorEl.textContent = "";

    const date = formatDateParam(currentDate);
    const body = {
        roomId: roomId,
        purpose: document.getElementById("purpose").value.trim(),
        startTime: `${date}T${document.getElementById("startTime").value}:00`,
        endTime: `${date}T${document.getElementById("endTime").value}:00`
    };

    const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        // Show the server's message (e.g. overlap) if there is one
        const data = await res.json().catch(() => null);
        errorEl.textContent = data?.message ?? "予約に失敗しました。";
        return;
    }

    closeBookingForm();
    showToast("予約しました。");
    loadBookings(roomId);
    loadStatus();
}

let toastTimer = null;

// Show a short message at the bottom of the screen for 2 seconds
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// Check who is logged in & show their name.
// Not logged in -> login page / initial password -> password change page
async function loadCurrentUser() {
    const res = await fetch("/api/auth/me");
    if (!res.ok) {
        location.href = "/login.html";
        return false;
    }

    const me = await res.json();
    if (me.mustChangePassword) {
        location.href = "/change-password.html";
        return false;
    }

    document.getElementById("userName").textContent = me.name;
    return true;
}

// ===== Event handlers =====

// One handler for every button inside the calendar
document.getElementById("calendar").onclick = e => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;

    if (btn.dataset.move) {
        calendarMonth.setMonth(calendarMonth.getMonth() + Number(btn.dataset.move));
        renderCalendar();
    } else if (btn.dataset.day) {
        setDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), Number(btn.dataset.day)));
    } else if ("today" in btn.dataset) {
        setDate(new Date());
    }
};

// Log out & go back to the login page
document.getElementById("logoutBtn").onclick = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login.html";
};

// ===== Initial render =====

calendarMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
renderCalendar();
renderAreas();
updateClock();

// Load the floor only after confirming the user is logged in
loadCurrentUser().then(ok => {
    if(ok) loadRooms().then(loadStatus);
});

// Refresh clock & room status every 30 seconds
setInterval(() => {
    updateClock();
    loadStatus();
}, 30000);
