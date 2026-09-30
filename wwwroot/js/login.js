// Log in, then go to the password change page or the main page
document.getElementById("loginForm").onsubmit = async e => {
    e.preventDefault(); // stop the page from reloading

    const errorEl = document.getElementById("loginError");
    errorEl.textContent = "";

    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        errorEl.textContent = data?.message ?? "ログインに失敗しました。";
        return;
    }

    // First login -> must change the initial password
    const user = await res.json();
    location.href = user.mustChangePassword ? "/change-password.html" : "/";
};