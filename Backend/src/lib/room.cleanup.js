import Room from "../models/Room.js";

const ROOM_INACTIVITY_EXPIRY_MINUTES = 30;

const cleanupExpiredRooms = async () => {
  try {
    const now = new Date();
    const inactivityDate = new Date(
      Date.now() - ROOM_INACTIVITY_EXPIRY_MINUTES * 60 * 1000
    );

    const result = await Room.deleteMany({
      $or: [
        { expiresAt: { $ne: null, $lt: now } },
        { expiryOption: "never", lastActivityAt: { $lt: inactivityDate } },
      ],
    });

    if (result.deletedCount > 0) {
      console.log(
        `Drift cleanup: removed ${result.deletedCount} expired temporary room(s)`
      );
    }
  } catch (error) {
    console.error("Drift room cleanup error:", error);
  }
};

const startRoomCleanup = () => {
  cleanupExpiredRooms();

  setInterval(
    cleanupExpiredRooms,
    5 * 60 * 1000
  );
};

export default startRoomCleanup;