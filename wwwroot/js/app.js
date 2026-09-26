// Virtual canvas size (portrait floor plan)
const BASE_WIDTH = 830;
const BASE_HEIGHT = 1160;

// Currently selected room (null = nothing selected)
let selectedRoomId = null;

// Date currently shown (defaults to today)
let currentDate = new Date();

// Convert a canvas value to a percentage of the floor
function toPercent(value, base) {
    return (value / base * 100) + "%";
}

// Format a Date as "YYYY-MM-DD" in localt time
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

async function loadRooms() {
    const res = await fetch("/api/rooms");
    if (!res.ok) {
        console.error("Failed to load rooms:", res.status);
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

// Render room info into the side panel
function renderRoomDetail(room) {
    const detail = document.getElementById("roomDetail");
    detail.innerHTML = `
        <div class="detail-head">
            <h3 class="detail-name">会議室 ${room.name}</h3>
            <span class="detail-cap">定員 ${room.capacity}名</span>
        </div>
        <h4 class="detail-subtitle">本日の予約</h4>
        <ul id="bookingList" class="booking-list">
            <li class="booking-empty">読み込み中...</li>
        </ul>
    `;
}

// Fetch bookings for the room on the current date
async function loadBookings(roomId) {
    const date = formatDateParam(currentDate);
    const res = await fetch(`/api/bookings?roomId=${roomId}&date=${date}`);

    // Ignore the response if another room was selected meanwhile
    if (roomId !== selectedRoomId) return;

    const list = document.getElementById("bookingList");

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

loadRooms();