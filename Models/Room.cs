namespace RoomSyncApi.Models
{
    // office room
    public class Room
    {
        public int Id { get; set; } // uwurmuts dugaar

        public string Name { get; set; } = ""; // uruunii ner

        public int Capacity { get; set; } // heden hun bagtah we

        // floor plan position (coordinate)
        public double PositionX { get; set; }
        public double PositionY { get; set; }

        public int Width { get; set; }
        public int Height { get; set; }
    }
}