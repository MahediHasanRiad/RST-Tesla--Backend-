export type AuthActor = { id: string; role: "PASSENGER" | "DRIVER" | "ADMIN"; sessionId: string };
export type TokenPair = { accessToken: string; refreshToken: string };
