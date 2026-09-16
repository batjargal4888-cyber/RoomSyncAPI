namespace RoomSyncApi.Models
{
    // uruunii zahialga
    public class Booking
    {
        public int Id { get; set; }

        public int RoomId { get; set; } // ali uruug zahialsan be (room tei holbogdono)
        public Room? Room { get; set; } // Room-iin buren medeelel ruu shiljih holboos

        public int UserId { get; set; } // hen zahialsan be (usertei holbogdono)
        public User? User { get; set; } // user iin buren medeelel ruu shiljih holboos

        public DateTime StartTime { get; set; } // zahialgiin ehleh tsag
        public DateTime EndTime { get; set; } // zahialgiin duusah tsag

        public string Purpose { get; set; } = ""; // zahialgiin zorilgo (jishee n "Client meeting")        
    }
}