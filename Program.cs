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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

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

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
