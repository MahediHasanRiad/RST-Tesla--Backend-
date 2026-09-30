import type { Server as SocketIOServer, Socket } from "socket.io";
import { authRepository } from "../api/v1/auth/auth.repository.js";
import { vehicleRepository } from "../api/v1/vehicles/vehicle.repository.js";
import { AuthCredentials } from "../shared/auth/credentials.js";
import { logger } from "../lib/logger.js";

type PresenceAck = (result: {
  ok: boolean;
  availability?: "ONLINE" | "OFFLINE";
  error?: string;
}) => void;

type DriverSocket = Socket & {
  data: Socket["data"] & {
    userId?: string;
    role?: string;
    driverId?: string;
    explicitlyOffline?: boolean;
  };
};

function getAccessToken(socket: Socket) {
  const token = socket.handshake.auth?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

export function createDriverPresence() {
  const socketsByDriver = new Map<string, Set<DriverSocket>>();

  async function authenticate(socket: Socket, next: (error?: Error) => void) {
    try {
      const accessToken = getAccessToken(socket);
      if (!accessToken) return next(new Error("unauthenticated"));

      // verify access token
      const actor = await AuthCredentials.verifyAccessToken(accessToken);

      // find user based on access token
      const user = await authRepository.findUserById(actor.userId);
      if (!user) return next(new Error("unauthenticated"));

      socket.data.userId = user.id;
      socket.data.role = user.role;
      if (user.role === "PASSENGER") return next();
      if (user.role !== "DRIVER") return next(new Error("forbidden"));

      // get driver info
      const driver = await vehicleRepository.findDriverByUserId(user.id);
      if (!driver) return next(new Error("driver_not_found"));

      socket.data.driverId = driver.id;
      return next();
    } 
    catch (error) {
      logger.warn("Driver presence authentication failed", {
        socketId: socket.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return next(new Error("unauthenticated"));
    }
  }

  async function setAvailability(driverId: string, availability: "ONLINE" | "OFFLINE") {
    const result = await vehicleRepository.setAvailabilityForDriver(
      driverId,
      availability,
    );
    if (result.kind === "missing") throw new Error("vehicle_not_found");
    return result.vehicle.availability;
  }

  async function markOffline(driverId: string) {
    try {
      await setAvailability(driverId, "OFFLINE");
    } catch (error) {
      logger.warn("Driver vehicle offline transition failed", {
        driverId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function disconnectDriverSockets(driverId: string) {
    const sockets = socketsByDriver.get(driverId);
    socketsByDriver.delete(driverId);
    if (!sockets) return;
    for (const socket of sockets) {
      socket.data.explicitlyOffline = true;
      socket.disconnect(true);
    }
  }

  async function handleConnection(socket: DriverSocket) {
    const driverId = socket.data.driverId;
    if (!driverId) {
      socket.disconnect(true);
      return;
    }

    let sockets = socketsByDriver.get(driverId);
    if (!sockets) {
      sockets = new Set();
      socketsByDriver.set(driverId, sockets);
    }
    sockets.add(socket);
    socket.data.explicitlyOffline = false;

    try {
      const availability = await setAvailability(driverId, "ONLINE");
      socket.emit("driver:presence", { availability });
    } catch (error) {
      sockets.delete(socket);
      if (sockets.size === 0) socketsByDriver.delete(driverId);
      socket.disconnect(true);
      logger.warn("Driver vehicle online transition failed", {
        driverId,
        socketId: socket.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const goOffline = async (ack?: PresenceAck) => {
      try {
        const availability = await setAvailability(driverId, "OFFLINE");
        ack?.({ ok: true, availability });
        await disconnectDriverSockets(driverId);
      } catch (error) {
        ack?.({ ok: false, error: "availability_update_failed" });
      }
    };

    socket.on("driver:offline", (ack?: PresenceAck) => {
      void goOffline(ack);
    });
    socket.on("driver:logout", (ack?: PresenceAck) => {
      void goOffline(ack);
    });
    socket.on("disconnect", () => {
      const activeSockets = socketsByDriver.get(driverId);
      activeSockets?.delete(socket);
      if (activeSockets && activeSockets.size > 0) return;
      socketsByDriver.delete(driverId);
      if (!socket.data.explicitlyOffline) void markOffline(driverId);
    });
  }

  function attach(io: SocketIOServer) {
    io.use((socket, next) => {
      void authenticate(socket, next);
    });
    io.on("connection", (socket) => {
      if ((socket.data as { role?: string }).role === "PASSENGER") return;
      void handleConnection(socket as DriverSocket);
    });
  }

  return { attach, authenticate, handleConnection, socketsByDriver };
}

export function attachDriverPresence(io: SocketIOServer) {
  const presence = createDriverPresence();
  presence.attach(io);
  return presence;
}
