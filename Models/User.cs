namespace RoomSyncApi.Models
{
    public class User
    {
        public int Id { get; set; }

        public string Name { get; set; } = "";

        public string Email { get; set; } = "";

        public string PasswordHash { get; set; } = ""; // stored as a hash, never plain text

        public string Role { get; set; } = "Employee"; // "Admin" or "Employee"

        // True until the user replaces the initial password
        public bool MustChangePassword { get; set; } = true;
    }
}