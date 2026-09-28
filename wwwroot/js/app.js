// Virtual canvas size (portrait floor plan)
const BASE_WIDTH = 830;
const BASE_HEIGHT = 1160;

// Currently selected room (null = nothing selected)
let selectedRoomId = null;

// Date currently shown (defaults to today)
let currentDate = new Date();

// Logged-in user (fixed for now, until login is added)
const CURRENT_USER_ID = 1;

// Bookable hours, in 30-minute slots
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const SLOT_MINUTES = 30;

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

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// Format a Date as "2026年9月28日(月)"
function formatDateLabel(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1; // getMonth() is 0-based
    const d = date.getDate();
    const w = WEEKDAYS[date.getDay()];
    return `${y}年${m}月${d}日 (${w})`;
}

// Show the date currently being viewed
function renderDate() {
    document.getElementById("dateLabel").textContent = formatDateLabel(currentDate);
}

// Show the current time as "HH:mm"
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("clock").textContent = `${h}:${m}`;
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

        // Position & size relative to the floor
        div.style.left   = toPercent(room.positionX, BASE_WIDTH);
        div.style.top    = toPercent(room.positionY, BASE_HEIGHT);
        div.style.width  = toPercent(room.width, BASE_WIDTH);
        div.style.height = toPercent(room.height, BASE_HEIGHT);

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
        <ul id="bookingList" class="booking-list">
            <li class="booking-empty">読み込み中...</li>
        </ul>

        <button type="button" id="addBookingBtn" class="add-booking-btn">✛ 予約を追加</button>

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
            <label>目的
                <input type="text" id="purpose" maxlength="50" placeholder="例：定例ミーティング">
            </label>
            <p id="formError" class="form-error"></p>
            <div class="form-actions">
                <button type="button" id="cancelBtn" class="btn-secondary">キャンセル</button>
                <button type="submit" class="btn-primary">予約する</button>
            </div>
        </form>
    `;

    document.getElementById("addBookingBtn").onclick = () => openBookingForm();
    document.getElementById("cancelBtn").onclick = closeBookingForm;
    document.getElementById("startTime").onchange = updateEndOptions;
    document.getElementById("bookingForm").onsubmit = e => submitBooking(e, room.id);
}

// Fetch bookings for the room on the current date
async function loadBookings(roomId) {
    const date = formatDateParam(currentDate);
    const res = await fetch(`/api/bookings?roomId=${roomId}&date=${date}`);

    // Ignore the response if another room was selected meanwhile
    if (roomId !== selectedRoomId) return;

    const list = document.getElementById("bookingList");

    document.getElementById("bookingTitle").textContent = isToday(currentDate)
        ? "本日の予約"
        : `${currentDate.getMonth() + 1}月${currentDate.getDate()}日 (${WEEKDAYS[currentDate.getDay()]}) の予約`;

    if (!res.ok) {
        list.innerHTML = `<li class="booking-empty">予約を取得できませんでした</li>`;
        return;
    }

    const bookings = await res.json();

    if (bookings.length === 0) {
        list.innerHTML = `<li class="booking-empty">予約はありません</li>`;
        return;
    }

    bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

    list.innerHTML = bookings.map(b => `
        <li class="booking-item">
            <span class="booking-time">${formatTime(b.startTime)}-${formatTime(b.endTime)}</span>
            <span class="booking-purpose">${b.purpose || "(目的なし)"}</span>
        </li>
    `).join("");
}

// True if the given date is today
function isToday(date) {
    return formatDateParam(date) === formatDateParam(new Date());
}

// Color rooms by whether they are in use right now
async function loadStatus() {
    // "In use" only makes sense for Today
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

// Next 30-minutes slot from now (opening time on other days)
function defaultStartTime() {
    const open = OPEN_HOUR * 60;
    const lastStart = CLOSE_HOUR * 60 - SLOT_MINUTES;
    if (!isToday(currentDate)) return open;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const next = Math.ceil(nowMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.min(Math.max(next, open), lastStart);
}

// Keep end-time options after the start time (default: +1 hour)
function updateEndOptions() {
    const start = toMinutes(document.getElementById("startTime").value);
    const close = CLOSE_HOUR * 60;
    const defaultEnd = Math.min(start + 60, close);
    document.getElementById("endTime").innerHTML =
        buildTimeOptions(start + SLOT_MINUTES, close, defaultEnd);
}

// Show the booking form (start time can be given, e.g. from the timeline)
function openBookingForm(start = defaultStartTime()) {
    document.getElementById("startTime").innerHTML =
        buildTimeOptions(OPEN_HOUR * 60, CLOSE_HOUR * 60 - SLOT_MINUTES, start);
    updateEndOptions();

    document.getElementById("purpose").value = "";
    document.getElementById("formError").textContent = "";
    document.getElementById("bookingForm").hidden = false;
    document.getElementById("addBookingBtn").hidden = true;
    document.getElementById("purpose").focus();
}

// Hide the booking form
function closeBookingForm() {
    document.getElementById("bookingForm").hidden = true;
    document.getElementById("addBookingBtn").hidden = false;
}

// Send a new booking for the selected room
async function submitBooking(e, roomId) {
    e.preventDefault(); // stop the page from reloading

    const errorEl = document.getElementById("formError");
    errorEl.textContent = "";

    const date = formatDateParam(currentDate);
    const body = {
        roomId: roomId,
        userId: CURRENT_USER_ID,
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

// Move the viewed date by the given number of days (-1 / +1)
function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    renderDate();
    loadStatus();

    // Reload the side panel if a room is selected
    if (selectedRoomId !== null) {
        loadBookings(selectedRoomId);
    }
}

document.getElementById("prevDay").onclick = () => changeDate(-1);
document.getElementById("nextDay").onclick = () => changeDate(1);

renderDate();
updateClock();
loadRooms().then(loadStatus);

// Refresh clock & room status every 30 seconds
setInterval(() => {
    updateClock();
    loadStatus();
}, 30000);