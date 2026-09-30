import type { Server as SocketIOServer } from "socket.io";

export type RideStatusUpdate = {
  rideRequestId: string;
  status: "MATCHED" | "CANCELLED";
};

let socketServer: SocketIOServer | undefined;

export function attachRideStatus(io: SocketIOServer) {
  socketServer = io;
}

export function emitRideStatusUpdate(
  passengerId: string | null | undefined,
  update: RideStatusUpdate,
) {
  if (!socketServer || !passengerId) return 0;

  let delivered = 0;
  for (const socket of socketServer.sockets.sockets.values()) {
    
    const data = socket.data as { userId?: string; role?: string };

    if (data.userId !== passengerId || data.role !== "PASSENGER") continue;
    socket.emit("ride:status-updated", update);
    delivered += 1;
    
  }
  return delivered;
}
