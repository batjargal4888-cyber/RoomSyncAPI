const BASE_WIDTH = 1160;
const BASE_HEIGHT = 830;

async function loadRooms() {
    const res = await fetch("/api/rooms");
    const rooms = await res.json();
    const floor = document.getElementById("floor");

    rooms.forEach(room => {
        const div = document.createElement("div");
        div.className = "room";
        div.style.left = (room.positionX / BASE_WIDTH * 100) + "%";
        div.style.top = (room.positionY / BASE_HEIGHT * 100) + "%";
        div.innerHTML = `
            <div class="name">${room.name}</div>
            <div class="cap">${room.capacity}名</div>
        `;
        div.onclick = () => alert(room.name + " がクリックされました");
        floor.appendChild(div);
    });
}

loadRooms();