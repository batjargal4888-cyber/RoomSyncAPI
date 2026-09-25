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
            new Room { Name = "A", Capacity = 2, PositionX = 642, PositionY = 484 },
            new Room { Name = "B", Capacity = 2, PositionX = 642, PositionY = 314 },
            new Room { Name = "C", Capacity = 4, PositionX = 592, PositionY = 148 },
            new Room { Name = "D", Capacity = 8, PositionX = 272, PositionY = 195 },
            new Room { Name = "E", Capacity = 4, PositionX = 272, PositionY = 459 }
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

app.Run();