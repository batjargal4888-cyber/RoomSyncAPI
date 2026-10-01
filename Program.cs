using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RoomSyncApi.Models;
using RoomSyncApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=roomsync.db"));

// Cookie-based login
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (!db.Rooms.Any())
    {
        db.Rooms.AddRange(
            new Room { Name = "A", Capacity = 2, PositionX = 585, PositionY = 570, Width = 245, Height = 280 },
            new Room { Name = "B", Capacity = 2, PositionX = 585, PositionY = 290, Width = 245, Height = 280 },
            new Room { Name = "C", Capacity = 4, PositionX = 375, PositionY = 0,   Width = 455, Height = 290 },
            new Room { Name = "D", Capacity = 8, PositionX = 0,   PositionY = 0,   Width = 375, Height = 670 },
            new Room { Name = "E", Capacity = 4, PositionX = 0,   PositionY = 670, Width = 375, Height = 275 }
        );
        db.SaveChanges();
    }

    if (!db.Users.Any())
    {
        db.Users.AddRange(
            new User { Name = "Batja", Email = "batja@example.com", Role = "Admin" },
            new User { Name = "Tanaka", Email = "tanaka@example.com" },
            new User { Name = "Suzuki", Email = "suzuki@example.com" }
        );
        db.SaveChanges();
    }

    // Give users without a password a random initial password.
    // It is printed once to the console so the admin can hand it over
    var hasher = new PasswordHasher<User>();
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    var usersWithoutPassword = db.Users
        .Where(u => u.PasswordHash == "")
        .ToList();

    foreach (var u in usersWithoutPassword)
    {
        var initialPassword = RandomNumberGenerator.GetString(chars, 8);
        u.PasswordHash = hasher.HashPassword(u, initialPassword);
        u.MustChangePassword = true;
        Console.WriteLine($"初期パスワード {u.Email} : {initialPassword}");
    }
    db.SaveChanges();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();

// ===== Room API =====

// Get all rooms
app.MapGet("/api/rooms", async (AppDbContext db) =>
    await db.Rooms.ToListAsync())
    .WithName("GetRooms");

// Get 1 room by id
app.MapGet("/api/rooms/{id}", async (int id , AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    return room is not null ? Results.Ok(room) : Results.NotFound();
})
.WithName("GetRoomId");

// ===== auth API =====

// Check email + password, then give the browser a login cookie
app.MapPost("/api/auth/login", async (LoginRequest req, AppDbContext db, HttpContext http) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
    var hasher = new PasswordHasher<User>();

    if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
    {
        return Results.BadRequest(new { message = "メールアドレスまたはパスワードが正しくありません。" });
    }

    // Information stored inside the cookie
    var claims = new List<Claim>
    {
        new(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new(ClaimTypes.Name, user.Name)
    };
    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    await http.SignInAsync(new ClaimsPrincipal(identity));

    return Results.Ok(new { user.Id, user.Name, user.MustChangePassword });
})
.WithName("Login");

// Remove the login cookie
app.MapPost("/api/auth/logout", async (HttpContext http) =>
{
    await http.SignOutAsync();
    return Results.Ok();
})
.WithName("Logout");

// Who is logged in (401 if nobody)
app.MapGet("/api/auth/me", async (ClaimsPrincipal principal, AppDbContext db) =>
{
    if (principal.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var user = await db.Users.FindAsync(userId);
    if (user is null)
        return Results.Unauthorized();

    return Results.Ok(new { user.Id, user.Name, user.MustChangePassword });
})
.WithName("Me");

// Replace the current password with a new one
app.MapPost("/api/auth/change-password", async (ChangePasswordRequest req, ClaimsPrincipal principal, AppDbContext db) =>
{
    if (principal.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var user = await db.Users.FindAsync(userId);
    if (user is null)
        return Results.Unauthorized();

    var hasher = new PasswordHasher<User>();
    if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
        return Results.BadRequest(new { message = "現在のパスワードが正しくありません。" });

    if (req.NewPassword.Length < 8)
        return Results.BadRequest(new { message = "新しいパスワードは８文字以上にしてください。" });

    if (req.NewPassword == req.CurrentPassword)
        return Results.BadRequest(new { message = "現在と異なるパスワードを指定してください。" });

    user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
    user.MustChangePassword = false;
    await db.SaveChangesAsync();

    return Results.Ok();
})
.WithName("ChangePassword");

// ===== booking API =====

// Get bookings for a day (optionally for 1 room)
app.MapGet("/api/bookings", async (int? roomId, DateTime date, AppDbContext db) =>
{
    var dayStart = date.Date;
    var dayEnd = dayStart.AddDays(1);

    var query = db.Bookings
        .Where(b => b.StartTime < dayEnd && b.EndTime > dayStart);

    if (roomId is not null)
        query = query.Where(b => b.RoomId == roomId);

    var bookings = await query
        .OrderBy(b => b.StartTime)
        .Select(b => new
        {
            b.Id,
            b.RoomId,
            b.UserId,
            UserName = b.User!.Name,
            b.Purpose,
            b.StartTime,
            b.EndTime,
            b.CreatedAt
        })
        .ToListAsync();

    return Results.Ok(bookings);
})
.WithName("GetBookings");

// Create a booking (checks business rules & overlap)
app.MapPost("/api/bookings", async (CreateBookingRequest req, ClaimsPrincipal principal, AppDbContext db) =>
{
    // Only logged-in users can book & the booker is taken from the cookie
    if (principal.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);

    if (req.EndTime <= req.StartTime)
        return Results.BadRequest(new { message = "終了時刻は開始時刻より後にしてください。" });

    // ===== Business rules (same as the frontend, but enforced here) =====

    // Weekdays only
    if (req.StartTime.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        return Results.BadRequest(new { message = "土日は予約できません。" });

    // Must start & end on the same day, within business hours (9:00 - 18:00)
    if (req.StartTime.Date != req.EndTime.Date
        || req.StartTime.TimeOfDay < TimeSpan.FromHours(9)
        || req.EndTime.TimeOfDay > TimeSpan.FromHours(18))
        return Results.BadRequest(new { message = "予約は9:00～18:00の範囲で指定してください。" });

    // No overlap with the lunch break (12:00-13:00)
    var lunchStart = req.StartTime.Date.AddHours(12);
    var lunchEnd = req.StartTime.Date.AddHours(13);
    if (req.StartTime < lunchEnd && req.EndTime > lunchStart)
        return Results.BadRequest(new { message = "12:00～13:00は昼休みのため予約できません。" });

    if (!await db.Rooms.AnyAsync(r => r.Id == req.RoomId))
        return Results.BadRequest(new { message = "会議室が存在しません。" });

    bool overlaps = await db.Bookings.AnyAsync(b =>
        b.RoomId == req.RoomId &&
        b.StartTime < req.EndTime &&
        req.StartTime < b.EndTime);

    if (overlaps)
        return Results.Conflict(new { message = "この時間帯はすでに予約されています。" });

    var booking = new Booking
    {
        RoomId = req.RoomId,
        UserId = userId,
        Purpose = req.Purpose,
        StartTime = req.StartTime,
        EndTime = req.EndTime
    };

    db.Bookings.Add(booking);
    await db.SaveChangesAsync();

    return Results.Created($"/api/bookings/{booking.Id}", new
    {
        booking.Id,
        booking.RoomId,
        booking.UserId,
        booking.Purpose,
        booking.StartTime,
        booking.EndTime,
        booking.CreatedAt
    });
})
.WithName("CreateBooking");

// cancel booking
app.MapDelete("/api/bookings/{id}", async (int id, AppDbContext db) =>
{
    var booking = await db.Bookings.FindAsync(id);
    if (booking is null) return Results.NotFound();

    db.Bookings.Remove(booking);
    await db.SaveChangesAsync();
    return Results.NoContent();
})
.WithName("DeleteBooking");

app.Run();

record CreateBookingRequest(int RoomId, string Purpose, DateTime StartTime, DateTime EndTime);
record LoginRequest(string Email, string Password);
record ChangePasswordRequest(string CurrentPassword, string NewPassword);