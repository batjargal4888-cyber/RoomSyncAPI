// Only logged-in users can use this page
async function checkLogin() {
    const res = await fetch("/api/auth/me");
    if (!res.ok) location.href = "/login.html";
}

// Send the new password, then go to the main page
document.getElementById("passwordForm").onsubmit = async e => {
    e.preventDefault(); // stop the page from reloading

    const errorEl = document.getElementById("passwordError");
    errorEl.textContent = "";

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // Check the 2 new passwords match before asking the server
    if (newPassword !== confirmPassword) {
        errorEl.textContent = "新しいパスワードが一致しません。";
        return;
    }

    const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            currentPassword: document.getElementById("currentPassword").value,
            newPassword: newPassword
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        errorEl.textContent = data?.message ?? "パスワードの変更に失敗しました。";
        return;
    }

    location.href = "/";
};

checkLogin();