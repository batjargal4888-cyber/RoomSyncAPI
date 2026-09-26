// Virtual canvas size (portrait floor plan)
const BASE_WIDTH = 830;
const BASE_HEIGHT = 1160;

// Convert a canvas value to a percentage of the floor
function toPercent(value, base) {
    return (value / base * 100) + "%";
}

async function loadRooms() {
    const res = await fetch("/api/rooms");
    if (!res.ok) {
        console.error("Failed to load rooms:", res.status);
        return;
    }

    const rooms = await res.json();
    const floor = document.getElementById("floor");

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

        // Temporary: will be replaced by the detail panel
        div.onclick = () => alert(room.name + " がクリックされました");
        
        floor.appendChild(div);
    });
}

loadRooms();