using Microsoft.EntityFrameworkCore;
using RoomSyncApi.Models;

namespace RoomSyncApi
{
    // ene code n C# code iig DB tei holbono
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        // edgeer DbSet bur DB dotorh 1 husnegttei tohirno
        public DbSet<Room> Rooms { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Booking> Bookings { get; set; }
    }
}