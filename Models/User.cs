namespace RoomSyncApi.Models
{
    public class User
    {
        public int Id { get; set; }

        public string Name { get; set; } = "";

        public string Email { get; set; } = "";

        public string PasswordHash { get; set; } = ""; // password (nuutslagdsan helbereer hadgalna)

        public string Role { get; set; } = "Employee"; // "admin" or "employee"
    }
}