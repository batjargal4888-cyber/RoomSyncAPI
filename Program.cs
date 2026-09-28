using Microsoft.EntityFrameworkCore;
using RoomSyncApi.Models;
using RoomSyncApi;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=roomsync.db"));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (!db.Rooms.Any())
    {
        db.Rooms.AddRange(
            new Room { Name = "A", Capacity = 2, PositionX = 585, PositionY = 565, Width = 245, Height = 280 },
            new Room { Name = "B", Capacity = 2, PositionX = 585, PositionY = 290, Width = 245, Height = 275 },
            new Room { Name = "C", Capacity = 4, PositionX = 380, PositionY = 0,   Width = 450, Height = 290 },
            new Room { Name = "D", Capacity = 8, PositionX = 0,   PositionY = 0,   Width = 375, Height = 670 },
            new Room { Name = "E", Capacity = 4, PositionX = 0,   PositionY = 670, Width = 370, Height = 275 }
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
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();

// ===== room CRUD API =====

// buh uruunii list awah
app.MapGet("/api/rooms", async (AppDbContext db) =>
    await db.Rooms.ToListAsync())
    .WithName("GetRooms");

// todorhoi 1 uruunii info get
app.MapGet("/api/rooms/{id}", async (int id , AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    return room is not null ? Results.Ok(room) : Results.NotFound();
})
.WithName("GetRoomId");

// new room add
app.MapPost("/api/rooms", async (Room room, AppDbContext db) =>
{
    db.Rooms.Add(room);
    await db.SaveChangesAsync();
    return Results.Created($"/api/rooms/{room.Id}", room);
})
.WithName("CreateRoom");

// room info change
app.MapPut("/api/rooms/{id}", async (int id, Room updatedRoom, AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    if (room is null) return Results.NotFound();

    room.Name = updatedRoom.Name;
    room.Capacity = updatedRoom.Capacity;
    room.PositionX = updatedRoom.PositionX;
    room.PositionY = updatedRoom.PositionY;
    room.Width = updatedRoom.Width;
    room.Height = updatedRoom.Height;

    await db.SaveChangesAsync();
    return Results.Ok(room);
})
.WithName("UpdateRoom");

// room delete
app.MapDelete("/api/rooms/{id}", async (int id, AppDbContext db) =>
{
    var room = await db.Rooms.FindAsync(id);
    if (room is null) return Results.NotFound();

    db.Rooms.Remove(room);
    await db.SaveChangesAsync();
    return Results.NoContent();
})
.WithName("DeleteRoom");

// ===== user API =====

// user choose dropdown user list (password not given ofc)
app.MapGet("/api/users", async (AppDbContext db) =>
    await db.Users
        .Select(u => new { u.Id, u.Name })
        .ToListAsync())
    .WithName("GetUsers");

// ===== booking API =====

// that 1 room reservations that day
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

// new reservation check overlap
app.MapPost("/api/bookings", async (CreateBookingRequest req, AppDbContext db) =>
{
    if (req.EndTime <= req.StartTime)
        return Results.BadRequest(new { message = "終了時刻は開始時刻より後にしてください。" });

    if (!await db.Rooms.AnyAsync(r => r.Id == req.RoomId))
        return Results.BadRequest(new { message = "会議室が存在しません。" });

    if (!await db.Users.AnyAsync(u => u.Id == req.UserId))
        return Results.BadRequest(new { message = "ユーザーが存在しません。" });

    bool overlaps = await db.Bookings.AnyAsync(b =>
        b.RoomId == req.RoomId &&
        b.StartTime < req.EndTime &&
        req.StartTime < b.EndTime);

    if (overlaps)
        return Results.Conflict(new { message = "この時間帯はすでに予約されています。" });

    var booking = new Booking
    {
        RoomId = req.RoomId,
        UserId = req.UserId,
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

record CreateBookingRequest(int RoomId, int UserId, string Purpose, DateTime StartTime, DateTime EndTime);