using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RoomSyncApi.Migrations
{
    /// <inheritdoc />
    public partial class AddRoomSize : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Height",
                table: "Rooms",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Width",
                table: "Rooms",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Height",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "Width",
                table: "Rooms");
        }
    }
}
